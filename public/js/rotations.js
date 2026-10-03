import {
  chosenBy,
  copyDraft,
  daysLabel,
  daysOf,
  draftChips,
  freeName,
  fromDraft,
  insert,
  lightingIcon,
  mapColour,
  mapLabel,
  move,
  nameProblem,
  newDraft,
  outcomeText,
  sameEntries,
  tidyName,
  toDraft,
} from './rotationmodel.js';
import { el } from './views.js';

// The staff page's Rotations tab: what is on the server today, which rotation each day of the week plays, and an editor
// for the saved rotations. Maps are dragged in from the palette and into order (or moved with the arrow keys), and each
// has its options: game mode, infantry only, hardcore, lighting and zones. Nothing changes until staff press Save.
// "Default" is the rotation for every day without one of its own; it can be changed, but not renamed or deleted.
//
// `load()` and `send(body)` reach the bot (GET and POST /api/admin/rotations) and resolve to { ok, status, json }.

// The page is read again when the tab is opened after this long.
const STALE_MS = 60_000;
// How long a message stays.
const TOAST_MS = 6_000;
// How far the pointer moves before a press on a map becomes a drag, so a tap still adds it.
const DRAG_START_PX = 6;
// Near the top or bottom of the window, a drag scrolls the page.
const SCROLL_EDGE_PX = 72;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// "06:00", the hour each rotation day starts, in the reader's own time on `day` (summer time included).
const localHour = (hour, day) => {
  const [y, m, d] = String(day ?? '').split('-').map(Number);
  const at = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) ? Date.UTC(y, m - 1, d, hour) : Date.UTC(2026, 0, 1, hour);
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(at));
};

const button = (text, props = {}) => el('button', { type: 'button', textContent: text, ...props });

export const createRotations = ({ root, load, send }) => {
  let page = null;
  let loadedAt = 0;
  let loading = null;
  let problem = null;
  // The rotation being edited: its name as typed, the saved name it came from (null for one not saved yet) and its maps.
  let draft = null;
  // The maps whose options are open, by key.
  const open = new Set();
  let busy = false;
  let drag = null;
  // A map just dropped or added, to light it up once.
  let dropped = null;

  const announcer = el('p', { className: 'visually-hidden', role: 'status' });
  const toasts = el('div', { className: 'rot-toasts', ariaLive: 'polite' });
  const content = el('div', { className: 'rot' });
  root.replaceChildren(content, announcer, toasts);

  const announce = (text) => {
    announcer.textContent = '';
    requestAnimationFrame(() => (announcer.textContent = text));
  };

  const toast = (text, kind = 'ok') => {
    // The bot's own messages are written for Discord, with **bold** names.
    const note = el('div', { className: `rot-toast rot-toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, el('span', { textContent: text.replace(/\*\*/g, '') }));
    const close = button('×', { className: 'rot-toast-close', ariaLabel: 'Close' });
    close.addEventListener('click', () => note.remove());
    note.append(close);
    toasts.append(note);
    setTimeout(() => note.remove(), kind === 'error' ? TOAST_MS * 2 : TOAST_MS);
  };

  const catalog = () => page?.catalog ?? null;
  const defaultName = () => page?.defaultName ?? 'Default';
  const isDefault = (name) => name !== null && name !== undefined && name.toLowerCase() === defaultName().toLowerCase();
  const saved = (name) => page?.rotations.find((r) => r.name.toLowerCase() === String(name ?? '').toLowerCase()) ?? null;

  const dirty = () => {
    if (!draft) return false;
    if (draft.from === null) return true;
    const original = saved(draft.from);
    return original === null || tidyName(draft.name) !== original.name || !sameEntries(draft.entries, original.entries);
  };

  const edit = (rotation) => {
    draft = { name: rotation.name, from: rotation.name, entries: rotation.entries.map((e) => toDraft(e, catalog())) };
    open.clear();
  };

  // Moves to another rotation, asking first when that would lose changes.
  const leave = () => !dirty() || window.confirm(`Discard your changes to ${tidyName(draft.name) || 'the new rotation'}?`);

  // The maps the palette offers: the catalogue's, or the three maps when the server could not say.
  const maps = () =>
    catalog()?.maps ?? [
      { id: 'Kavkazi', name: 'Bakurani', modes: [], modifiers: [], zones: [] },
      { id: 'Europe', name: 'Ozeti', modes: [], modifiers: [], zones: [] },
      { id: 'NorthAmerica', name: 'Zestafona', modes: [], modifiers: [], zones: [] },
    ];

  // A thin bar in the maps' colours, one piece per map, in order.
  const strip = (entries, className = 'rot-strip') =>
    el(
      'div',
      { className, ariaHidden: 'true' },
      ...entries.map((e) => {
        const piece = el('span', { className: 'rot-strip-piece' });
        const key = mapColour(e.map, catalog());
        if (key) piece.dataset.map = key;
        return piece;
      }),
    );

  const mapChip = (mapId, props = {}) => {
    const chip = el('span', { className: 'rot-map', textContent: mapLabel(mapId, catalog()), ...props });
    const key = mapColour(mapId, catalog());
    if (key) chip.dataset.map = key;
    return chip;
  };

  // --- Talking to the bot ---

  const refresh = async () => {
    loading ??= (async () => {
      const answer = await load().catch(() => ({ ok: false, status: 0, json: null }));
      loading = null;
      if (!answer.ok) {
        problem =
          answer.status === 404
            ? 'The bot does not have the Rotations tab yet. Deploy the latest bot.'
            : (answer.json?.error ?? 'Could not load the rotations. Trying again when you come back to this tab.');
        loadedAt = 0;
        render();
        return;
      }
      problem = null;
      page = answer.json;
      loadedAt = Date.now();
      // Picks up the latest of what is open, unless staff are changing it.
      const current = draft && !dirty() ? (saved(draft.from) ?? null) : null;
      if (!draft || (!dirty() && current === null)) {
        const first = saved(defaultName()) ?? page.rotations[0];
        if (first) edit(first);
        else draft = { name: defaultName(), from: null, entries: [] };
      } else if (current) edit(current);
      render();
    })();
    return loading;
  };

  // Sends a change; on success the bot sends the page as it is now. Returns the answer, or null when it failed.
  const change = async (body, { quiet = false } = {}) => {
    if (busy) return null;
    busy = true;
    render();
    try {
      const answer = await send(body).catch(() => ({ ok: false, json: null }));
      if (!answer.ok) {
        toast(answer.json?.error ?? "Couldn't reach the bot. If it was a change, check before trying again.", 'error');
        return null;
      }
      page = answer.json;
      loadedAt = Date.now();
      if (!quiet && answer.json?.outcome?.outcome === 'failed') toast(outcomeText(answer.json.outcome, ''), 'warn');
      return answer;
    } finally {
      busy = false;
      render();
    }
  };

  // --- Actions ---

  const select = (name) => {
    if (draft && draft.from !== null && draft.from.toLowerCase() === name.toLowerCase()) return;
    if (!leave()) return;
    const rotation = saved(name);
    if (rotation) edit(rotation);
    render();
  };

  const startNew = (entries = [], base = 'New rotation') => {
    if (!leave()) return;
    draft = { name: freeName(base, (page?.rotations ?? []).map((r) => r.name)), from: null, entries };
    open.clear();
    render();
    requestAnimationFrame(() => {
      const input = content.querySelector('[data-focus="name"]');
      input?.focus();
      input?.select();
    });
  };

  const save = async () => {
    if (!draft) return null;
    const name = tidyName(draft.name);
    if (!isDefault(draft.from)) {
      const others = page.rotations.map((r) => r.name).filter((n) => n.toLowerCase() !== String(draft.from ?? '').toLowerCase());
      const why = nameProblem(name, { max: page.limits.name, taken: others, defaultName: defaultName() });
      if (why) {
        toast(why, 'error');
        content.querySelector('[data-focus="name"]')?.focus();
        return null;
      }
    }
    if (draft.entries.length === 0) {
      toast('Add at least one map first: drag one in from above.', 'error');
      return null;
    }
    const from = draft.from !== null && draft.from !== name ? { from: draft.from } : {};
    const answer = await change({ action: 'save', name, ...from, entries: draft.entries.map(fromDraft) }, { quiet: true });
    if (!answer) return null;
    const rotation = saved(name);
    if (rotation) edit(rotation);
    toast(`Saved ${name}. ${outcomeText(answer.json.outcome, name)}`.trim(), answer.json.outcome?.outcome === 'failed' ? 'warn' : 'ok');
    render();
    return answer;
  };

  const tomorrowNote = () => {
    if (!page) return '';
    const tomorrow = page.plan[(page.today.weekday + 1) % 7];
    return tomorrow ? ` Tomorrow's, ${tomorrow}, goes on at ${localHour(page.hour, page.today.day)}.` : '';
  };

  const putOn = async (name) => {
    if (!page) return;
    const editing = draft && draft.from !== null && draft.from.toLowerCase() === name.toLowerCase();
    if (editing && dirty()) {
      if (!window.confirm(`Save your changes to ${name} and put it on the server for the rest of today?`)) return;
      if (!(await save())) return;
    } else if (!window.confirm(`Put ${name} on the server for the rest of today? It plays from the next map.${tomorrowNote()}`)) {
      return;
    }
    const answer = await change({ action: 'use', name: tidyName(editing ? draft.name : name) }, { quiet: true });
    if (answer) toast(outcomeText(answer.json.outcome, name) || `${name} is on for today.`, answer.json.outcome?.outcome === 'failed' ? 'warn' : 'ok');
  };

  const remove = async () => {
    if (!draft || draft.from === null) {
      if (!window.confirm('Throw away this new rotation?')) return;
      draft = null;
      const first = saved(defaultName()) ?? page?.rotations[0];
      if (first) edit(first);
      render();
      return;
    }
    const name = draft.from;
    const days = daysOf(page.week.map((n) => n), name);
    const note = days.length > 0 ? ` ${daysLabel(days, page.weekdays)} go back to ${defaultName()}.` : '';
    if (!window.confirm(`Delete ${name}?${note}`)) return;
    const answer = await change({ action: 'delete', name }, { quiet: true });
    if (!answer) return;
    draft = null;
    const first = saved(defaultName()) ?? page.rotations[0];
    if (first) edit(first);
    toast(`Deleted ${name}.${note} ${outcomeText(answer.json.outcome, defaultName())}`.trim());
    render();
  };

  const plan = async (day, value, select) => {
    const name = value === '' ? null : value;
    const shown = name ?? defaultName();
    const today = day === page.today.weekday;
    if (today && page.plan[day] !== shown && !window.confirm(`It's ${page.weekdays[day]}: this puts ${shown} on the server now, from the next map. Go ahead?`)) {
      select.value = page.week[day] ?? '';
      return;
    }
    const answer = await change({ action: 'schedule', days: [day], name }, { quiet: true });
    if (!answer) {
      select.value = page.week[day] ?? '';
      return;
    }
    toast(`${page.weekdays[day]}s: ${shown}. ${today ? outcomeText(answer.json.outcome, shown) : ''}`.trim(), answer.json.outcome?.outcome === 'failed' ? 'warn' : 'ok');
  };

  const copyServer = () => {
    const entries = page?.server?.entries ?? [];
    if (entries.length === 0 || !draft) return;
    if (draft.entries.length > 0 && !window.confirm(`Replace the ${draft.entries.length} maps here with the server's ${entries.length}?`)) return;
    draft.entries = entries.map((e) => toDraft(e, catalog()));
    open.clear();
    render();
    announce(`Copied the server's ${entries.length} maps in. Save to keep them.`);
  };

  // --- Changing the maps ---

  const setEntries = (entries, note) => {
    draft.entries = entries;
    render();
    if (note) announce(note);
  };

  const addMap = (mapId, at = draft.entries.length) => {
    if (draft.entries.length >= (page?.limits.maps ?? 100)) {
      toast(`A rotation can have at most ${page?.limits.maps ?? 100} maps.`, 'error');
      return;
    }
    const entry = newDraft(mapId, catalog());
    dropped = entry.key;
    setEntries(insert(draft.entries, at, entry), `Added ${mapLabel(mapId, catalog())} at number ${at + 1} of ${draft.entries.length + 1}.`);
  };

  const moveMap = (from, to, focus = false) => {
    const entry = draft.entries[from];
    if (!entry || to < 0 || to >= draft.entries.length || from === to) return;
    dropped = entry.key;
    setEntries(move(draft.entries, from, to), `${mapLabel(entry.map, catalog())} moved to number ${to + 1} of ${draft.entries.length}.`);
    if (focus) content.querySelector(`[data-focus="handle-${entry.key}"]`)?.focus();
  };

  const update = (key, changes) => {
    draft.entries = draft.entries.map((e) => (e.key === key ? { ...e, ...changes } : e));
    render();
  };

  // --- Drag and drop, with the pointer (mouse, pen or touch) ---

  const listEl = () => content.querySelector('.rot-list');

  const items = (list) => [...list.children].filter((n) => n.classList.contains('rot-item') && !n.classList.contains('rot-dragging'));

  // Moves the gap to where the pointer is, sliding the other maps out of the way.
  const placeGap = (list, y) => {
    const others = items(list);
    const before = others.find((n) => {
      const box = n.getBoundingClientRect();
      return y < box.top + box.height / 2;
    });
    const at = before ?? null;
    if (drag.gap.parentNode === list && drag.gap.nextSibling === at) return;
    const tops = new Map(others.map((n) => [n, n.getBoundingClientRect().top]));
    list.insertBefore(drag.gap, at);
    list.classList.add('rot-list-target');
    if (reducedMotion()) return;
    for (const n of others) {
      const delta = (tops.get(n) ?? 0) - n.getBoundingClientRect().top;
      if (delta) n.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 150, easing: 'ease-out' });
    }
  };

  const dragAt = (x, y) => {
    drag.x = x;
    drag.y = y;
    drag.ghost.style.transform = `translate(${x - drag.offsetX}px, ${y - drag.offsetY}px)`;
    const list = listEl();
    if (!list) return;
    const box = list.getBoundingClientRect();
    // Adding needs the pointer over the list; moving always has a place.
    const over = drag.kind === 'move' || (x > box.left - 48 && x < box.right + 48 && y > box.top - 48 && y < box.bottom + 48);
    if (over) placeGap(list, y);
    else if (drag.gap.parentNode) {
      drag.gap.remove();
      list.classList.remove('rot-list-target');
    }
  };

  // Keeps scrolling the page while the pointer rests near its top or bottom.
  const autoScroll = () => {
    if (!drag) return;
    const speed = drag.y < SCROLL_EDGE_PX ? -(SCROLL_EDGE_PX - drag.y) / 4 : drag.y > window.innerHeight - SCROLL_EDGE_PX ? (drag.y - (window.innerHeight - SCROLL_EDGE_PX)) / 4 : 0;
    if (speed) {
      window.scrollBy(0, speed);
      dragAt(drag.x, drag.y);
    }
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const beginDrag = (pending) => {
    const { kind, source, x, y } = pending;
    const box = source.getBoundingClientRect();
    const ghost =
      kind === 'move'
        ? source.cloneNode(true)
        : el('div', { className: 'rot-ghost-tile' }, mapChip(pending.mapId), el('span', { className: 'rot-ghost-hint', textContent: 'Drop in the list' }));
    ghost.classList.add('rot-ghost');
    ghost.style.width = `${kind === 'move' ? box.width : Math.max(box.width, 220)}px`;
    const gap = el('li', { className: 'rot-gap', ariaHidden: 'true' });
    gap.style.height = `${kind === 'move' ? box.height : 56}px`;
    drag = { ...pending, ghost, gap, offsetX: kind === 'move' ? x - box.left : 24, offsetY: kind === 'move' ? y - box.top : 24, x, y, frame: 0 };
    document.body.append(ghost);
    document.body.classList.add('rot-grabbing');
    if (kind === 'move') {
      source.parentNode.insertBefore(gap, source);
      source.classList.add('rot-dragging');
    }
    dragAt(x, y);
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const endDrag = (drop) => {
    if (!drag) return;
    const { kind, gap, ghost, source } = drag;
    cancelAnimationFrame(drag.frame);
    const list = listEl();
    const at = gap.parentNode === list ? [...list.children].filter((n) => n === gap || (n.classList.contains('rot-item') && !n.classList.contains('rot-dragging'))).indexOf(gap) : -1;
    ghost.remove();
    gap.remove();
    source.classList.remove('rot-dragging');
    list?.classList.remove('rot-list-target');
    document.body.classList.remove('rot-grabbing');
    const done = drag;
    drag = null;
    if (!drop || at < 0) {
      render();
      return;
    }
    if (kind === 'move') moveMap(done.index, at);
    else addMap(done.mapId, at);
  };

  // A press on a map's handle, or on a map in the palette. It becomes a drag once the pointer moves; on the palette, a
  // press that does not move is a tap, which adds the map at the end.
  const pressable = (node, describe) => {
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || busy || drag) return;
      const start = { ...describe(), x: event.clientX, y: event.clientY, id: event.pointerId };
      let pending = start;
      node.setPointerCapture(event.pointerId);
      const moveTo = (e) => {
        if (e.pointerId !== start.id) return;
        if (pending && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= DRAG_START_PX) {
          beginDrag({ ...pending, x: e.clientX, y: e.clientY });
          pending = null;
        }
        if (drag) {
          e.preventDefault();
          dragAt(e.clientX, e.clientY);
        }
      };
      const finish = (e) => {
        if (e.pointerId !== start.id) return;
        node.removeEventListener('pointermove', moveTo);
        node.removeEventListener('pointerup', finish);
        node.removeEventListener('pointercancel', finish);
        if (drag) {
          // The click that follows a drag does nothing.
          node.dataset.dragged = 'true';
          setTimeout(() => delete node.dataset.dragged, 0);
          endDrag(e.type === 'pointerup');
        }
      };
      node.addEventListener('pointermove', moveTo);
      node.addEventListener('pointerup', finish);
      node.addEventListener('pointercancel', finish);
    });
  };

  document.addEventListener('keydown', (event) => {
    if (drag && event.key === 'Escape') endDrag(false);
  });

  window.addEventListener('beforeunload', (event) => {
    if (dirty()) event.preventDefault();
  });

  // --- Drawing ---

  const todayCard = () => {
    const current = page.current;
    const planned = page.plan[page.today.weekday];
    const server = page.server;
    const now = server?.entries.find((e) => e.status === 'now');
    const next = server?.entries.find((e) => e.status === 'next');
    const name = current?.name ?? planned;
    const rotation = name ? saved(name) : null;
    const swap = el(
      'select',
      { className: 'finder-input rot-swap-select', ariaLabel: 'Rotation to put on now' },
      ...page.rotations.filter((r) => r.entries.length > 0).map((r) => el('option', { value: r.name, textContent: r.name, selected: r.name === name })),
    );
    swap.dataset.focus = 'swap';
    const swapButton = button('Put on now', { className: 'btn btn-small rot-btn-primary', disabled: busy || page.rotations.length === 0 });
    swapButton.addEventListener('click', () => putOn(swap.value));
    return el(
      'section',
      { className: 'card rot-today', ariaLabel: 'On the server today' },
      el(
        'div',
        { className: 'rot-today-main' },
        el('p', { className: 'rot-kicker', textContent: `Today · ${page.weekdays[page.today.weekday]}` }),
        el('h3', { className: 'rot-today-name', textContent: name ?? 'No rotation picked' }),
        el(
          'p',
          { className: 'rot-today-sub' },
          current ? chosenBy(current) : name ? 'goes on at the next check' : "the server keeps the rotation it has",
          rotation ? ` · ${rotation.entries.length} map${rotation.entries.length === 1 ? '' : 's'}` : '',
          current?.pending ? el('span', { className: 'badge badge-hot rot-pending', textContent: 'Not on the server yet' }) : null,
        ),
        rotation ? strip(rotation.entries, 'rot-strip rot-strip-today') : null,
      ),
      el(
        'div',
        { className: 'rot-nownext' },
        el('div', { className: 'rot-nn' }, el('span', { className: 'rot-nn-label', textContent: 'Now' }), now ? mapChip(now.map) : el('span', { className: 'muted', textContent: server ? '–' : 'Server not answering' })),
        el('div', { className: 'rot-nn' }, el('span', { className: 'rot-nn-label', textContent: 'Next' }), next ? mapChip(next.map) : el('span', { className: 'muted', textContent: '–' })),
        server && !server.enabled ? el('p', { className: 'rot-note', textContent: 'The rotation is off on the server, so the map repeats.' }) : null,
        server?.enabled && server.mode === 'random' ? el('p', { className: 'rot-note', textContent: 'The server plays its rotation in random order.' }) : null,
      ),
      el(
        'div',
        { className: 'rot-swap' },
        el('label', { className: 'rot-field-label', textContent: 'Swap for the rest of today' }),
        el('div', { className: 'rot-swap-row' }, swap, swapButton),
        el('p', { className: 'rot-note', textContent: `Each day's rotation goes on at ${localHour(page.hour, page.today.day)} your time.` }),
      ),
    );
  };

  const weekCard = () => {
    const choices = page.rotations.filter((r) => !isDefault(r.name));
    const card = el(
      'section',
      { className: 'card panel rot-week' },
      el(
        'div',
        { className: 'panel-head' },
        el('h3', { className: 'panel-title', id: 'rot-week-title', textContent: 'The week' }),
        el('p', { className: 'section-note', textContent: `Days without a rotation of their own play ${defaultName()}.` }),
      ),
      el(
        'div',
        { className: 'rot-days' },
        ...page.weekdays.map((day, i) => {
          const isToday = i === page.today.weekday;
          const own = page.week[i];
          const plays = page.plan[i];
          const rotation = plays ? saved(plays) : null;
          const pick = el(
            'select',
            { className: 'finder-input rot-day-select', disabled: busy, ariaLabel: `Rotation for ${day}` },
            el('option', { value: '', textContent: defaultName() }),
            ...choices.map((r) => el('option', { value: r.name, textContent: r.name, selected: own !== null && own.toLowerCase() === r.name.toLowerCase(), disabled: r.entries.length === 0 })),
          );
          pick.dataset.focus = `day-${i}`;
          pick.addEventListener('change', () => plan(i, pick.value, pick));
          return el(
            'div',
            { className: `rot-day${isToday ? ' rot-day-today' : ''}${own ? ' rot-day-own' : ''}` },
            el('p', { className: 'rot-day-name' }, el('span', { className: 'rot-day-long', textContent: day }), el('span', { className: 'rot-day-short', textContent: day.slice(0, 3) }), isToday ? el('span', { className: 'rot-today-chip', textContent: 'Today' }) : null),
            pick,
            rotation ? strip(rotation.entries, 'rot-strip rot-strip-day') : el('p', { className: 'rot-note', textContent: 'Keeps what the server has' }),
          );
        }),
      ),
    );
    card.setAttribute('aria-labelledby', 'rot-week-title');
    return card;
  };

  const sideCard = () => {
    const full = page.rotations.length >= page.limits.rotations;
    const newButton = button('+ New rotation', { className: 'btn btn-ghost btn-small rot-new', disabled: busy || full, title: full ? `At most ${page.limits.rotations} rotations` : '' });
    newButton.addEventListener('click', () => startNew());
    const list = el(
      'ul',
      { className: 'rot-names' },
      ...page.rotations.map((r) => {
        const active = draft?.from !== null && draft?.from?.toLowerCase() === r.name.toLowerCase();
        const days = daysOf(page.plan, r.name);
        const onNow = page.current?.name?.toLowerCase() === r.name.toLowerCase();
        const card = button('', { className: 'rot-name-card' });
        if (active) card.setAttribute('aria-current', 'true');
        card.dataset.focus = `pick-${r.name}`;
        card.append(
          el('span', { className: 'rot-name-top' }, el('span', { className: 'rot-name-text', textContent: active ? tidyName(draft.name) || r.name : r.name }), active && dirty() ? el('span', { className: 'rot-dot', title: 'Unsaved changes' }) : null),
          el('span', { className: 'rot-name-meta', textContent: [`${r.entries.length} map${r.entries.length === 1 ? '' : 's'}`, daysLabel(days, page.weekdays)].filter(Boolean).join(' · ') }),
          strip(r.entries, 'rot-strip rot-strip-mini'),
          el('span', { className: 'badges' }, isDefault(r.name) ? el('span', { className: 'badge', textContent: 'Default' }) : null, onNow ? el('span', { className: 'badge badge-accent', textContent: 'On now' }) : null),
        );
        card.addEventListener('click', () => select(r.name));
        return el('li', {}, card);
      }),
      draft?.from === null
        ? el('li', {}, el('div', { className: 'rot-name-card rot-name-new', ariaCurrent: 'true' }, el('span', { className: 'rot-name-top' }, el('span', { className: 'rot-name-text', textContent: tidyName(draft.name) || 'New rotation' }), el('span', { className: 'rot-dot' })), el('span', { className: 'rot-name-meta', textContent: 'Not saved yet' })))
        : null,
    );
    return el(
      'aside',
      { className: 'card panel rot-side', ariaLabel: 'Saved rotations' },
      el('div', { className: 'panel-head' }, el('h3', { className: 'panel-title', textContent: 'Rotations' }), el('span', { className: 'rot-count', textContent: `${page.rotations.length} of ${page.limits.rotations}` })),
      list,
      newButton,
    );
  };

  const optionsPanel = (entry, index) => {
    const map = catalog()?.maps.find((m) => m.id === entry.map) ?? null;
    const field = (label, control) => el('label', { className: 'rot-option' }, el('span', { className: 'rot-field-label', textContent: label }), control);
    const selectOf = (focus, value, choices, onChange) => {
      const s = el('select', { className: 'finder-input' }, ...choices.map(([v, text]) => el('option', { value: v, textContent: text, selected: v === value })));
      s.dataset.focus = `${focus}-${entry.key}`;
      s.addEventListener('change', () => onChange(s.value));
      return s;
    };
    const modes = map?.modes ?? [];
    const modeChoices = [
      ...(entry.mode === '' ? [['', "The map's own"]] : []),
      ...modes.map((m) => [m.id, m.name]),
      ...(entry.mode && !modes.some((m) => m.id === entry.mode) ? [[entry.mode, entry.mode]] : []),
    ];
    const toggles = (map?.modifiers ?? []).map((m) => {
      const on = entry.modifiers.includes(m.id);
      const toggle = button('', { className: 'rot-switch', role: 'switch', ariaChecked: String(on) });
      toggle.setAttribute('aria-checked', String(on));
      toggle.dataset.focus = `${m.key}-${entry.key}`;
      toggle.append(el('span', { className: 'rot-switch-track', ariaHidden: 'true' }, el('span', { className: 'rot-switch-knob' })), el('span', { textContent: m.name }));
      toggle.addEventListener('click', () => update(entry.key, { modifiers: on ? entry.modifiers.filter((id) => id !== m.id) : [...entry.modifiers, m.id] }));
      return toggle;
    });
    const lightings = catalog()?.lightings ?? [];
    const zones = map?.zones ?? [];
    const duplicate = button('Duplicate', { className: 'btn btn-ghost btn-small' });
    duplicate.addEventListener('click', () => {
      const copy = copyDraft(entry);
      dropped = copy.key;
      open.add(copy.key);
      setEntries(insert(draft.entries, index + 1, copy), `Duplicated ${mapLabel(entry.map, catalog())} as number ${index + 2}.`);
    });
    return el(
      'div',
      { className: 'rot-options', id: `rot-options-${entry.key}` },
      field('Game mode', selectOf('mode', entry.mode, modeChoices, (v) => update(entry.key, { mode: v }))),
      field(
        'Lighting',
        selectOf('lighting', entry.lighting, [['', "The map's own"], ...lightings.map((l) => [l.id, `${lightingIcon(l.id)} ${l.name}`]), ...(entry.lighting && !lightings.some((l) => l.id === entry.lighting) ? [[entry.lighting, entry.lighting]] : [])], (v) =>
          update(entry.key, { lighting: v }),
        ),
      ),
      field(
        'Control zones',
        selectOf('zones', entry.zone, [['', "The map's own"], ...zones.map((z) => [z.id, z.name]), ...(entry.zone && !zones.some((z) => z.id === entry.zone) ? [[entry.zone, entry.zone.split('.').at(-1)]] : [])], (v) =>
          update(entry.key, { zone: v }),
        ),
      ),
      toggles.length > 0 ? el('div', { className: 'rot-switches' }, ...toggles) : null,
      el('div', { className: 'rot-options-foot' }, duplicate),
    );
  };

  const row = (entry, index) => {
    const isOpen = open.has(entry.key);
    const name = mapLabel(entry.map, catalog());
    const handle = button('', { className: 'rot-handle', ariaLabel: `Move ${name}, number ${index + 1} of ${draft.entries.length}. Drag it, or use the up and down arrow keys.` });
    handle.dataset.focus = `handle-${entry.key}`;
    handle.append(el('span', { className: 'rot-grip', ariaHidden: 'true' }));
    handle.addEventListener('keydown', (event) => {
      const to = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: draft.entries.length - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      moveMap(index, to, true);
    });
    const item = el('li', { className: `rot-item${isOpen ? ' rot-item-open' : ''}${dropped === entry.key ? ' rot-dropped' : ''}` });
    pressable(handle, () => ({ kind: 'move', index, source: item }));
    const chips = draftChips(entry, catalog());
    const toggle = button('', { className: 'rot-icon-btn rot-options-btn', ariaLabel: `Options for ${name}`, ariaExpanded: String(isOpen), title: 'Mode, lighting and zones' });
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-controls', `rot-options-${entry.key}`);
    toggle.dataset.focus = `options-${entry.key}`;
    toggle.append(el('span', { className: 'rot-gear', ariaHidden: 'true', textContent: '⚙' }));
    toggle.addEventListener('click', () => {
      if (isOpen) open.delete(entry.key);
      else open.add(entry.key);
      render();
    });
    const drop = button('', { className: 'rot-icon-btn rot-remove', ariaLabel: `Take ${name} out`, title: 'Take it out' });
    drop.append(el('span', { ariaHidden: 'true', textContent: '✕' }));
    drop.addEventListener('click', () => {
      open.delete(entry.key);
      setEntries(draft.entries.filter((e) => e.key !== entry.key), `Took ${name} out.`);
    });
    item.dataset.key = entry.key;
    const colour = mapColour(entry.map, catalog());
    if (colour) item.dataset.map = colour;
    const summary = el(
      'div',
      { className: 'rot-row' },
      handle,
      el('span', { className: 'rot-num', textContent: String(index + 1) }),
      mapChip(entry.map, { className: 'rot-map rot-map-big' }),
      el('span', { className: 'rot-chips' }, ...(chips.length > 0 ? chips.map((c) => el('span', { className: `rot-chip rot-chip-${c.kind}`, textContent: c.text })) : [el('span', { className: 'rot-chip rot-chip-plain', textContent: "The map's own setup" })])),
      el('span', { className: 'rot-row-actions' }, toggle, drop),
    );
    summary.addEventListener('click', (event) => {
      if (event.target.closest('button, select, a')) return;
      toggle.click();
    });
    item.append(summary);
    if (isOpen) item.append(optionsPanel(entry, index));
    return item;
  };

  const editorCard = () => {
    const name = tidyName(draft.name);
    const locked = isDefault(draft.from);
    const others = page.rotations.map((r) => r.name).filter((n) => n.toLowerCase() !== String(draft.from ?? '').toLowerCase());
    const why = locked ? null : nameProblem(draft.name, { max: page.limits.name, taken: others, defaultName: defaultName() });
    const changed = dirty();
    const input = el('input', { className: 'rot-name-input', type: 'text', value: draft.name, maxLength: page.limits.name, disabled: locked, spellcheck: false, autocomplete: 'off', ariaLabel: 'Rotation name' });
    input.dataset.focus = 'name';
    const nameNote = el('p', { className: `rot-name-note${why ? ' rot-name-bad' : ''}`, textContent: locked ? `${defaultName()} keeps its name: it plays on every day without a rotation of its own.` : (why ?? '') });
    const saveButton = button(busy ? 'Saving…' : 'Save', { className: 'btn btn-small rot-btn-primary', disabled: busy || !changed || draft.entries.length === 0 || Boolean(why) });
    const discard = button('Discard changes', { className: 'btn btn-ghost btn-small', disabled: busy || !changed || draft.from === null });
    const status = el('span', { className: `rot-status${changed ? ' rot-status-dirty' : ''}`, textContent: changed ? (draft.from === null ? 'Not saved yet' : 'Unsaved changes') : 'Saved' });
    input.addEventListener('input', () => {
      draft.name = input.value;
      // Only the parts that depend on the name, so typing keeps its place.
      const problemNow = nameProblem(draft.name, { max: page.limits.name, taken: others, defaultName: defaultName() });
      nameNote.textContent = problemNow ?? '';
      nameNote.classList.toggle('rot-name-bad', Boolean(problemNow));
      const nowChanged = dirty();
      saveButton.disabled = busy || !nowChanged || draft.entries.length === 0 || Boolean(problemNow);
      discard.disabled = busy || !nowChanged || draft.from === null;
      status.textContent = nowChanged ? (draft.from === null ? 'Not saved yet' : 'Unsaved changes') : 'Saved';
      status.classList.toggle('rot-status-dirty', nowChanged);
      const side = content.querySelector('.rot-name-card[aria-current="true"] .rot-name-text');
      if (side) side.textContent = tidyName(draft.name) || 'New rotation';
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
    });
    saveButton.addEventListener('click', () => save());
    discard.addEventListener('click', () => {
      const original = saved(draft.from);
      if (original) edit(original);
      render();
      announce('Changes discarded.');
    });
    const putButton = button('Put on server', { className: 'btn btn-ghost btn-small', disabled: busy || draft.from === null || draft.entries.length === 0, title: draft.from === null ? 'Save it first' : '' });
    putButton.addEventListener('click', () => putOn(draft.from));
    const full = page.rotations.length >= page.limits.rotations;
    const duplicate = button('Duplicate', { className: 'rot-menu-item', disabled: busy || full || draft.entries.length === 0 });
    duplicate.addEventListener('click', () => startNew(draft.entries.map(copyDraft), `${name || 'Rotation'} copy`));
    const fromServer = button("Copy the server's maps in", { className: 'rot-menu-item', disabled: busy || !(page.server?.entries.length > 0) });
    fromServer.addEventListener('click', copyServer);
    const del = button(draft.from === null ? 'Throw away' : 'Delete', { className: 'rot-menu-item rot-menu-danger', disabled: busy || locked, title: locked ? `${defaultName()} can't be deleted` : '' });
    del.addEventListener('click', remove);
    const more = el('details', { className: 'rot-more' }, el('summary', { className: 'btn btn-ghost btn-small', textContent: 'More' }), el('div', { className: 'rot-menu' }, duplicate, fromServer, del));
    for (const item of [duplicate, fromServer, del]) item.addEventListener('click', () => more.removeAttribute('open'));

    const palette = el(
      'div',
      { className: 'rot-palette' },
      ...maps().map((m) => {
        const tile = button('', { className: 'rot-tile', ariaLabel: `Add ${m.name} at the end`, disabled: busy });
        const key = mapColour(m.id, catalog());
        if (key) tile.dataset.map = key;
        tile.append(el('span', { className: 'rot-tile-plus', ariaHidden: 'true', textContent: '+' }), el('span', { className: 'rot-tile-name', textContent: m.name }), el('span', { className: 'rot-tile-meta', textContent: m.modes.length > 0 ? `${m.modes.length} mode${m.modes.length === 1 ? '' : 's'}` : 'Drag or tap' }));
        pressable(tile, () => ({ kind: 'add', mapId: m.id, source: tile }));
        tile.addEventListener('click', () => {
          if (tile.dataset.dragged) return;
          addMap(m.id);
        });
        return tile;
      }),
    );

    const list = el('ol', { className: `rot-list${draft.entries.length === 0 ? ' rot-list-empty' : ''}` }, ...draft.entries.map(row));
    if (draft.entries.length === 0) list.append(el('li', { className: 'rot-empty', textContent: 'Drag a map here, or tap one above.' }));

    return el(
      'section',
      { className: 'card panel rot-editor', ariaLabel: 'Edit rotation' },
      el(
        'div',
        { className: 'rot-editor-head' },
        el('div', { className: 'rot-name-field' }, el('label', { className: 'rot-field-label', textContent: 'Rotation' }), el('div', { className: 'rot-name-row' }, input, locked ? el('span', { className: 'badge', textContent: 'Default' }) : null), nameNote),
        el('div', { className: 'rot-actions' }, status, saveButton, discard, putButton, more),
      ),
      el(
        'div',
        { className: 'rot-preview' },
        strip(draft.entries.map(fromDraft), 'rot-strip rot-strip-big'),
        el('p', { className: 'rot-note', textContent: draft.entries.length === 0 ? 'No maps yet' : `${draft.entries.length} map${draft.entries.length === 1 ? '' : 's'}, played in this order and then round again` }),
      ),
      el('p', { className: 'rot-field-label rot-palette-label', textContent: 'Add a map: drag it into the list, or tap it to add it at the end' }),
      palette,
      catalog() === null ? el('p', { className: 'rot-note rot-warn', textContent: "The server isn't answering, so its modes, lighting and zones can't be listed right now. Maps added now play their own setup." }) : null,
      list,
      el('p', { className: 'rot-note rot-tip', textContent: 'Drag ⠿ to reorder (or focus it and use the arrow keys). ⚙ sets the mode, infantry only, hardcore, lighting and zones.' }),
    );
  };

  const render = () => {
    if (drag) return;
    const focused = document.activeElement?.dataset?.focus ?? null;
    if (problem && !page) {
      content.replaceChildren(el('div', { className: 'card panel' }, el('p', { textContent: problem })));
      return;
    }
    if (!page || !draft) {
      content.replaceChildren(el('div', { className: 'card panel rot-loading' }, el('p', { className: 'muted', textContent: 'Loading the rotations…' })));
      return;
    }
    content.replaceChildren(todayCard(), weekCard(), el('div', { className: 'rot-workspace' }, sideCard(), editorCard()));
    content.classList.toggle('rot-busy', busy);
    if (focused) content.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    dropped = null;
  };

  return {
    // When the tab is opened: loads, or loads again when what it has is old.
    show() {
      if (!page || Date.now() - loadedAt > STALE_MS) refresh();
      else render();
    },
    // Loads once, if nothing has been loaded yet.
    ensure() {
      if (!page && !problem) refresh();
    },
    // Signing out forgets everything.
    reset() {
      page = null;
      draft = null;
      problem = null;
      loadedAt = 0;
      open.clear();
      render();
    },
    get dirty() {
      return dirty();
    },
  };
};
