import { ask } from './ask.js';
import { groupLists, lineProblem, linesToSave, listLabel, messageLength, messageParts, problemCount, sameLines, tidyLine } from './linesmodel.js';
import { clockHour, factionColours } from './format.js';
import { el, sideName } from './views.js';

// The staff page's Lines tab: the lines the bot says in game, list by list. Pick a list on the left, change its lines,
// and Save; the next message of that kind uses them. Each line shows its whole message as it goes out, with what the
// bot adds, and how much of the game's 200 characters it uses. "Use the bot's lines" puts a list back to the bot's own.
//
// `load()` and `send(body)` reach the bot (GET and POST /api/admin/lines) and resolve to { ok, status, json }.

// The page is read again when the tab is opened after this long.
const STALE_MS = 60_000;
// How long a message stays.
const TOAST_MS = 6_000;

const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });

const button = (text, props = {}) => el('button', { type: 'button', textContent: text, ...props });

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const createLines = ({ root, load, send }) => {
  let page = null;
  let loadedAt = 0;
  let loading = null;
  let problem = null;
  // The list being edited, and its lines as typed. Each line has a key of its own, so it keeps focus as lines come and go.
  let selected = null;
  let draft = [];
  // The line whose message is shown in game.
  let active = null;
  let busy = false;
  let keys = 0;
  const newLine = (text = '') => ({ key: `l${(keys += 1)}`, text });

  const announcer = el('p', { className: 'visually-hidden', role: 'status' });
  const toasts = el('div', { className: 'rot-toasts', ariaLive: 'polite' });
  const content = el('div', { className: 'rot lines' });
  root.replaceChildren(content, announcer, toasts);

  const announce = (text) => {
    announcer.textContent = '';
    requestAnimationFrame(() => (announcer.textContent = text));
  };

  const toast = (text, kind = 'ok') => {
    const note = el('div', { className: `rot-toast rot-toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, el('span', { textContent: text }));
    const close = button('×', { className: 'rot-toast-close', ariaLabel: 'Close' });
    close.addEventListener('click', () => note.remove());
    note.append(close);
    toasts.append(note);
    setTimeout(() => note.remove(), kind === 'error' ? TOAST_MS * 2 : TOAST_MS);
  };

  const max = () => page?.max ?? 200;
  const list = () => page?.lists.find((l) => l.id === selected) ?? null;
  const texts = () => draft.map((line) => line.text);
  const dirty = () => {
    const current = list();
    return current !== null && !sameLines(linesToSave(texts()), current.lines);
  };
  const problems = () => {
    const current = list();
    return current === null ? [] : draft.map((line) => lineProblem(current, line.text, max())).filter(Boolean);
  };

  const edit = (current) => {
    selected = current.id;
    draft = current.lines.map((text) => newLine(text));
    active = draft[0]?.key ?? null;
  };

  // Moves to another list, asking first when that would lose changes.
  const leave = async () => !dirty() || ask(`Discard your changes to the ${listLabel(list())} lines?`, { yes: 'Discard changes', no: 'Keep editing', danger: true });

  window.addEventListener('beforeunload', (event) => {
    if (dirty()) event.preventDefault();
  });

  // --- Talking to the bot ---

  // Bumped by reset (signing out), so an answer that arrives after it is dropped.
  let generation = 0;

  // Takes the page the bot sent. The list being edited follows it, unless staff had changed it: whether they had is
  // asked of the page they were editing, before it is replaced. After their own save it always follows.
  const adopt = (next, { saved = false } = {}) => {
    const edited = dirty();
    page = next;
    loadedAt = Date.now();
    const current = list();
    if (current === null) {
      const first = page.lists[0] ?? null;
      if (first) edit(first);
      else draft = [];
      return;
    }
    if (saved) {
      const at = Math.max(0, draft.findIndex((line) => line.key === active));
      edit(current);
      active = draft[Math.min(at, draft.length - 1)]?.key ?? null;
      return;
    }
    if (!edited && !sameLines(linesToSave(texts()), current.lines)) edit(current);
  };

  const refresh = async () => {
    const mine = generation;
    loading ??= (async () => {
      const answer = await load().catch(() => ({ ok: false, status: 0, json: null }));
      loading = null;
      if (mine !== generation) return;
      if (!answer.ok) {
        problem =
          answer.status === 404
            ? 'The bot does not have the Lines tab yet. Deploy the latest bot.'
            : (answer.json?.error ?? 'Could not load the lines. Trying again when you come back to this tab.');
        loadedAt = 0;
        render();
        return;
      }
      problem = null;
      adopt(answer.json);
      render();
    })();
    return loading;
  };

  // While a change is on its way, the tab can't be changed (it is inert), so no edit is lost when the answer comes back.
  const lock = (on) => {
    content.classList.toggle('rot-busy', on);
    for (const part of content.querySelectorAll('.rot-workspace')) part.inert = on;
    const save = content.querySelector('[data-role="save"]');
    if (save && on) save.textContent = 'Working…';
  };

  // Sends a change; on success the bot sends the page as it is now. Returns whether it worked.
  const change = async (body) => {
    if (busy) return false;
    const mine = generation;
    const focused = document.activeElement?.dataset?.focus ?? null;
    busy = true;
    lock(true);
    try {
      const answer = await send(body).catch(() => ({ ok: false, json: null }));
      if (mine !== generation) return false;
      if (!answer.ok) {
        toast(answer.json?.error ?? "Couldn't reach the bot. If it was a change, check before trying again.", 'error');
        return false;
      }
      adopt(answer.json, { saved: true });
      return true;
    } finally {
      if (mine === generation) {
        busy = false;
        lock(false);
        render(focused);
      }
    }
  };

  // --- Actions ---

  const select = async (id) => {
    if (id === selected) return;
    if (!(await leave())) return;
    const next = page?.lists.find((l) => l.id === id);
    if (!next) return;
    edit(next);
    render();
    // On a narrow screen the editor is under the lists.
    if (window.matchMedia('(max-width: 899px)').matches) content.querySelector('.rot-editor')?.scrollIntoView({ block: 'start' });
  };

  const focusLine = (key) =>
    requestAnimationFrame(() => content.querySelector(`[data-focus="line-${CSS.escape(key)}"]`)?.focus({ preventScroll: false }));

  // A new line after `index` (at the end without one).
  const addLine = (index = draft.length - 1) => {
    if (draft.length >= (page?.maxLines ?? 50)) return;
    const line = newLine();
    draft.splice(index + 1, 0, line);
    active = line.key;
    render();
    focusLine(line.key);
  };

  const removeLine = (key) => {
    const index = draft.findIndex((line) => line.key === key);
    if (index < 0) return;
    draft.splice(index, 1);
    const next = draft[Math.min(index, draft.length - 1)] ?? null;
    if (active === key) active = next?.key ?? null;
    render();
    if (next) focusLine(next.key);
    else requestAnimationFrame(() => content.querySelector('[data-focus="add"]')?.focus());
    announce('Line taken out');
  };

  const save = async () => {
    const current = list();
    if (!current || !dirty()) return;
    const lines = linesToSave(texts());
    if (lines.length === 0) {
      toast("Keep at least one line. To go back to the bot's own lines, use \"Use the bot's lines\".", 'error');
      return;
    }
    if (problems().length > 0) {
      toast('Some lines need changing first: see the notes under them.', 'error');
      return;
    }
    if (await change({ action: 'save', list: current.id, lines })) {
      toast(`Saved the ${listLabel(current)} lines. The next message uses them.`);
      announce('Saved');
    }
  };

  const discard = () => {
    const current = list();
    if (!current) return;
    edit(current);
    render();
  };

  const useBots = async () => {
    const current = list();
    if (!current?.changed) return;
    if (!(await ask(`Put the bot's own ${listLabel(current)} lines back? The lines here now are thrown away.`, { yes: 'Use the bot’s lines', danger: true }))) return;
    if (await change({ action: 'reset', list: current.id })) toast(`The ${listLabel(current)} lines are the bot's own again.`);
  };

  // Puts a placeholder in the line being edited, where the cursor is.
  const fillIn = (name) => {
    const line = draft.find((l) => l.key === active) ?? draft[draft.length - 1];
    if (!line) return;
    const input = content.querySelector(`[data-focus="line-${CSS.escape(line.key)}"]`);
    const token = `{${name}}`;
    const start = input?.selectionStart ?? line.text.length;
    const end = input?.selectionEnd ?? line.text.length;
    line.text = `${line.text.slice(0, start)}${token}${line.text.slice(end)}`;
    if (input) {
      input.value = line.text;
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    }
    update(line.key);
  };

  // --- Drawing ---

  const changedText = (current) =>
    current.changed
      ? `Changed by ${current.changed.byName || 'staff'}, ${when.format(new Date(current.changed.at))}`
      : "The bot's own lines";

  const sideCard = () => {
    const groups = groupLists(page.lists);
    return el(
      'aside',
      { className: 'card panel rot-side', ariaLabel: 'Lists of lines' },
      el('h2', { className: 'panel-title', textContent: 'In-game lines' }),
      el('p', {
        className: 'rot-note',
        textContent: 'Each time the bot sends a message in game, it picks one line at random from its list.',
      }),
      ...groups.flatMap((group) => [
        group.lists.length > 1 ? el('p', { className: 'rot-field-label lines-group', textContent: group.name }) : null,
        el(
          'ul',
          { className: 'rot-names' },
          ...group.lists.map((l) => {
            const on = l.id === selected;
            const wrong = problemCount(l, max());
            const card = button('', { className: 'rot-name-card' });
            if (on) card.setAttribute('aria-current', 'true');
            card.addEventListener('click', () => select(l.id));
            card.append(
              el(
                'span',
                { className: 'rot-name-top' },
                // A faction's list in its colour, to spot at a glance.
                sideName(group.lists.length > 1 ? l.name : listLabel(l), factionColours, 'rot-name-text'),
                on && dirty() ? el('span', { className: 'rot-dot', title: 'Unsaved changes' }) : null,
              ),
              el('span', { className: 'rot-name-meta', textContent: `${plural(l.lines.length, 'line')} · ${l.changed ? 'changed by staff' : "the bot's own"}` }),
              el(
                'span',
                { className: 'badges' },
                ...(wrong > 0 ? [el('span', { className: 'badge badge-bad', textContent: `${wrong} too long or wrong` })] : []),
                ...(l.off ? [el('span', { className: 'badge', textContent: 'Not sent now' })] : []),
              ),
            );
            return el('li', {}, card);
          }),
        ),
      ]),
    );
  };

  // The message in game, with what the bot adds dimmed.
  const preview = (current) => {
    const line = draft.find((l) => l.key === active) ?? draft.find((l) => tidyLine(l.text) !== '') ?? null;
    const box = el('div', { className: 'lines-preview' });
    box.dataset.role = 'preview';
    box.append(el('span', { className: 'rot-field-label', textContent: 'In game' }));
    if (line === null || tidyLine(line.text) === '') {
      box.append(el('p', { className: 'muted', textContent: 'Type a line to see the message.' }));
      return box;
    }
    const parts = messageParts(current, line.text);
    box.append(
      el(
        'p',
        { className: 'lines-message' },
        parts.before ? el('span', { className: 'lines-added', textContent: parts.before }) : null,
        el('span', { textContent: parts.line }),
        parts.after ? el('span', { className: 'lines-added', textContent: parts.after }) : null,
      ),
    );
    const index = draft.indexOf(line);
    box.append(
      el('p', {
        className: 'rot-note',
        textContent: `Line ${index + 1}. The dimmed parts are what the bot adds. The count takes {score} and {team} at the longest they can be, so it can be more than this shows.`,
      }),
    );
    return box;
  };

  const counter = (current, text) => {
    const length = messageLength(current, text);
    const over = length > max();
    return { text: tidyLine(text) === '' ? '' : `${length}/${max()}`, over };
  };

  const lineItem = (current, line, index) => {
    const why = lineProblem(current, line.text, max());
    const count = counter(current, line.text);
    const noteId = `lines-note-${line.key}`;
    const input = el('input', {
      className: 'finder-input lines-input',
      type: 'text',
      value: line.text,
      maxLength: 500,
      spellcheck: true,
      autocomplete: 'off',
      ariaLabel: `Line ${index + 1}`,
      ariaInvalid: String(why !== null),
    });
    input.dataset.focus = `line-${line.key}`;
    input.setAttribute('aria-describedby', noteId);
    input.addEventListener('input', () => {
      line.text = input.value;
      update(line.key);
    });
    input.addEventListener('focus', () => {
      if (active === line.key) return;
      active = line.key;
      content.querySelector('[data-role="preview"]')?.replaceWith(preview(current));
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addLine(draft.indexOf(line));
    });
    const remove = button('×', { className: 'rot-icon-btn lines-remove', ariaLabel: `Take line ${index + 1} out`, title: 'Take it out' });
    remove.addEventListener('click', () => removeLine(line.key));
    const item = el(
      'li',
      { className: `lines-row${why ? ' lines-row-bad' : ''}` },
      el('span', { className: 'lines-num', textContent: String(index + 1), ariaHidden: 'true' }),
      el(
        'div',
        { className: 'lines-field' },
        input,
        el('p', { className: 'lines-problem', id: noteId, textContent: why ?? '' }),
      ),
      el('span', { className: `lines-count${count.over ? ' lines-count-over' : ''}`, textContent: count.text, title: 'Characters in the whole message at its longest, with each placeholder as long as it can be, of the most the game shows' }),
      remove,
    );
    item.dataset.key = line.key;
    return item;
  };

  // After typing: the line's count and note, the message in game, and whether there is anything to save. The rest stays
  // as it is, so the cursor stays put.
  const update = (key) => {
    const current = list();
    if (!current) return;
    const index = draft.findIndex((l) => l.key === key);
    const line = draft[index];
    const item = content.querySelector(`.lines-row[data-key="${CSS.escape(key)}"]`);
    if (line && item) {
      const why = lineProblem(current, line.text, max());
      const count = counter(current, line.text);
      item.classList.toggle('lines-row-bad', why !== null);
      item.querySelector('.lines-problem').textContent = why ?? '';
      item.querySelector('.lines-input').setAttribute('aria-invalid', String(why !== null));
      const shown = item.querySelector('.lines-count');
      shown.textContent = count.text;
      shown.classList.toggle('lines-count-over', count.over);
    }
    active = key;
    content.querySelector('[data-role="preview"]')?.replaceWith(preview(current));
    const changed = dirty();
    const status = content.querySelector('[data-role="status"]');
    if (status) {
      status.textContent = changed ? 'Unsaved changes' : 'Saved';
      status.classList.toggle('rot-status-dirty', changed);
    }
    const saveButton = content.querySelector('[data-role="save"]');
    if (saveButton) saveButton.disabled = busy || !changed;
    const discardButton = content.querySelector('[data-role="discard"]');
    if (discardButton) discardButton.disabled = busy || !changed;
    content.querySelector('.rot-side')?.replaceWith(sideCard());
  };

  const editorCard = () => {
    const current = list();
    const changed = dirty();
    const full = draft.length >= page.maxLines;
    const status = el('span', { className: `rot-status${changed ? ' rot-status-dirty' : ''}`, textContent: changed ? 'Unsaved changes' : 'Saved' });
    status.dataset.role = 'status';
    const saveButton = button('Save', { className: 'btn btn-small rot-btn-primary', disabled: busy || !changed });
    saveButton.dataset.role = 'save';
    saveButton.addEventListener('click', save);
    const discardButton = button('Discard changes', { className: 'btn btn-ghost btn-small', disabled: busy || !changed });
    discardButton.dataset.role = 'discard';
    discardButton.addEventListener('click', discard);
    const botsButton = button("Use the bot's lines", {
      className: 'btn btn-ghost btn-small',
      disabled: busy || !current.changed,
      title: current.changed ? '' : "These are the bot's own lines already",
    });
    botsButton.addEventListener('click', useBots);

    const fills = Object.entries(current.values);
    const add = button('+ Add a line', {
      className: 'btn btn-ghost btn-small rot-new lines-add',
      disabled: busy || full,
      title: full ? `A list can have at most ${page.maxLines} lines` : '',
    });
    add.dataset.focus = 'add';
    add.addEventListener('click', () => addLine());

    return el(
      'section',
      { className: 'card panel rot-editor', ariaLabel: `${listLabel(current)} lines` },
      el(
        'div',
        { className: 'rot-editor-head' },
        el(
          'div',
          { className: 'rot-name-field' },
          current.group === current.name ? null : el('span', { className: 'rot-field-label', textContent: current.group }),
          el('h3', { className: 'lines-title', textContent: current.name }),
          el('p', { className: 'rot-name-note', textContent: changedText(current) }),
        ),
        el('div', { className: 'rot-actions' }, status, saveButton, discardButton, botsButton),
      ),
      el('p', { className: 'lines-when', textContent: current.note }),
      current.off ? el('p', { className: 'rot-note rot-warn', textContent: current.off }) : null,
      fills.length > 0
        ? el(
            'div',
            { className: 'lines-fills' },
            el('span', { className: 'rot-field-label', textContent: 'Filled in by the bot' }),
            ...fills.map(([name, value]) => {
              const chip = button(`{${name}}`, { className: 'lines-fill', title: `Put {${name}} in the line. Now it would say “${value}”.` });
              chip.addEventListener('mousedown', (event) => event.preventDefault());
              chip.addEventListener('click', () => fillIn(name));
              return el('span', { className: 'lines-fill-item' }, chip, el('span', { className: 'muted', textContent: ` ${value}` }));
            }),
          )
        : el('p', { className: 'rot-note', textContent: 'These lines have no placeholders: they go out as they are.' }),
      preview(current),
      draft.length === 0
        ? el('p', { className: 'rot-note rot-warn', textContent: "No lines. Add one, or use the bot's lines." })
        : el('ol', { className: 'lines-list' }, ...draft.map((line, i) => lineItem(current, line, i))),
      el(
        'div',
        { className: 'lines-foot' },
        add,
        el('span', { className: 'rot-note', textContent: `${plural(linesToSave(texts()).length, 'line')} of up to ${page.maxLines}. Enter adds a line after the one you're on.` }),
      ),
    );
  };

  const render = (keep = null) => {
    const focused = document.activeElement?.dataset?.focus ?? keep;
    if (problem && !page) {
      content.replaceChildren(el('div', { className: 'card panel' }, el('p', { textContent: problem })));
      return;
    }
    if (!page || !list()) {
      content.replaceChildren(el('div', { className: 'card panel rot-loading' }, el('p', { className: 'muted', textContent: 'Loading the lines…' })));
      return;
    }
    content.replaceChildren(el('div', { className: 'rot-workspace' }, sideCard(), editorCard()));
    if (focused) content.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
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
    // Signing out forgets everything, and any answer still on its way.
    reset() {
      generation += 1;
      busy = false;
      loading = null;
      page = null;
      selected = null;
      draft = [];
      active = null;
      problem = null;
      loadedAt = 0;
      render();
    },
    get dirty() {
      return dirty();
    },
  };
};
