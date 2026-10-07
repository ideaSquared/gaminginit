import { clockHour, WEAPON_KINDS } from './format.js';
import {
  draftOf,
  kickParts,
  kicks,
  MODE_LABELS,
  MODES,
  modeNote,
  ruleProblem,
  sameRule,
  takenWeapons,
  tidy,
  todayText,
  warningParts,
  warns,
  weaponGroups,
  weaponsOf,
  withoutWeapon,
  withWeapon,
} from './rulesmodel.js';
import { el } from './views.js';

// The staff page's Weapon rules tab: weapons the server doesn't allow, such as the Humvee's gun, and what the bot does
// when someone kills with one: nothing, a warning in game, warnings and then a kick, or a kick. Pick a rule on the
// left, change it and Save; the bot uses it from the next kill. "+ New rule" adds one, "Take out" removes one.
//
// `load()` and `send(body)` reach the bot (GET and POST /api/admin/rules) and resolve to { ok, status, json }.

// The page is read again when the tab is opened after this long, for today's warnings and kicks.
const STALE_MS = 60_000;
// How long a message stays.
const TOAST_MS = 6_000;
// The rule being made, before it has an id.
const NEW = 'new';

const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });

const button = (text, props = {}) => el('button', { type: 'button', textContent: text, ...props });

const KIND_NAMES = { weapon: 'Hand-held', ...WEAPON_KINDS };

const MODE_BADGES = { off: '', warn: 'hot', 'warn-kick': 'hot', kick: 'bad' };

export const createRules = ({ root, load, send }) => {
  let page = null;
  let loadedAt = 0;
  let loading = null;
  let problem = null;
  // The rule being edited (NEW for a new one), and the rule as staff have it on the page.
  let selected = null;
  let draft = null;
  let busy = false;

  const announcer = el('p', { className: 'visually-hidden', role: 'status' });
  const toasts = el('div', { className: 'rot-toasts', ariaLive: 'polite' });
  const content = el('div', { className: 'rot rules' });
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

  const rule = () => page?.rules.find((r) => r.id === selected) ?? null;
  const dirty = () => draft !== null && (selected === NEW || (rule() !== null && !sameRule(draft, rule())));
  const label = () => tidy(draft?.name) || 'new';

  const edit = (id) => {
    selected = id;
    draft = id === NEW ? draftOf(null) : draftOf(page.rules.find((r) => r.id === id));
  };

  // The first rule, or nothing when there are none.
  const editFirst = () => {
    const first = page.rules[0];
    if (first) edit(first.id);
    else {
      selected = null;
      draft = null;
    }
  };

  // Moves to another rule, asking first when that would lose changes.
  const leave = () => !dirty() || window.confirm(`Discard your changes to the ${label()} rule?`);

  window.addEventListener('beforeunload', (event) => {
    if (dirty()) event.preventDefault();
  });

  // --- Talking to the bot ---

  // Bumped by reset (signing out), so an answer that arrives after it is dropped.
  let generation = 0;

  // Takes the page the bot sent. The rule being edited follows it unless staff had changed it; after their own change it
  // always does. `id` is the rule to show after a save, which for a new rule is only known now.
  const adopt = (next, { saved = false, id = selected } = {}) => {
    const edited = dirty();
    page = next;
    loadedAt = Date.now();
    if (saved) {
      if (page.rules.some((r) => r.id === id)) edit(id);
      else editFirst();
      return;
    }
    if (selected === NEW) return;
    if (rule() === null) editFirst();
    else if (!edited) edit(selected);
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
            ? 'The bot does not have weapon rules yet. Deploy the latest bot.'
            : (answer.json?.error ?? 'Could not load the weapon rules. Trying again when you come back to this tab.');
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

  // Sends a change; on success the bot sends the page as it is now. Returns the page, or null when it didn't work.
  const change = async (body, then) => {
    if (busy) return null;
    const mine = generation;
    const focused = document.activeElement?.dataset?.focus ?? null;
    busy = true;
    lock(true);
    try {
      const answer = await send(body).catch(() => ({ ok: false, json: null }));
      if (mine !== generation) return null;
      if (!answer.ok) {
        toast(answer.json?.error ?? "Couldn't reach the bot. If it was a change, check before trying again.", 'error');
        return null;
      }
      adopt(answer.json, { saved: true, id: then(answer.json) });
      return answer.json;
    } finally {
      if (mine === generation) {
        busy = false;
        lock(false);
        render(focused);
      }
    }
  };

  // --- Actions ---

  const select = (id) => {
    if (id === selected) return;
    if (!leave()) return;
    edit(id);
    render();
    // On a narrow screen the editor is under the list.
    if (window.matchMedia('(max-width: 899px)').matches) content.querySelector('.rot-editor')?.scrollIntoView({ block: 'start' });
    if (id === NEW) requestAnimationFrame(() => content.querySelector('[data-focus="name"]')?.focus());
  };

  const save = async () => {
    if (!draft || !dirty()) return;
    const why = ruleProblem(draft, page.rules, page);
    if (why) {
      toast(why, 'error');
      return;
    }
    const name = tidy(draft.name);
    const isNew = selected === NEW;
    // A new rule is the one the bot added at the end.
    const done = await change({ action: 'save', ...draft }, (next) => (isNew ? (next.rules.at(-1)?.id ?? NEW) : selected));
    if (done) {
      toast(isNew ? `Added the ${name} rule.` : `Saved the ${name} rule. The bot uses it from the next kill.`);
      announce('Saved');
    }
  };

  const discard = () => {
    if (selected === NEW) editFirst();
    else edit(selected);
    render();
  };

  const remove = async () => {
    const current = rule();
    if (!current) return;
    if (!window.confirm(`Take the ${current.name} rule out? The bot stops warning and kicking for its weapons.`)) return;
    if (await change({ action: 'remove', id: current.id }, () => null)) toast(`Took the ${current.name} rule out.`);
  };

  const setMode = (mode) => {
    draft.mode = mode;
    render();
  };

  const setWarnings = (warnings) => {
    draft.warnings = warnings;
    render();
  };

  const addWeapon = (name) => {
    const weapon = page.weapons.find((w) => w.name === name);
    if (!weapon) return;
    draft.weapons = withWeapon(draft.weapons, weapon);
    render('add-weapon');
  };

  const removeWeapon = (weapon) => {
    draft.weapons = withoutWeapon(draft.weapons, weapon);
    render('add-weapon');
    announce(`${weapon.name} taken out`);
  };

  // --- Drawing ---

  const changedText = (current) => {
    if (current === null) return 'Not saved yet';
    return current.changed ? `Changed by ${current.changed.byName || 'staff'}, ${when.format(new Date(current.changed.at))}` : 'Ready-made by the bot';
  };

  const sideCard = () => {
    const full = page.rules.length >= page.maxRules;
    const add = button('+ New rule', {
      className: 'btn btn-ghost btn-small rot-new',
      disabled: busy || full || selected === NEW,
      title: full ? `There can be at most ${page.maxRules} rules` : '',
    });
    add.addEventListener('click', () => select(NEW));
    const card = (r) => {
      const on = r.id === selected;
      const item = button('', { className: 'rot-name-card' });
      if (on) item.setAttribute('aria-current', 'true');
      item.addEventListener('click', () => select(r.id));
      const today = todayText(r.today);
      item.append(
        el(
          'span',
          { className: 'rot-name-top' },
          el('span', { className: 'rot-name-text', textContent: r.name }),
          on && dirty() ? el('span', { className: 'rot-dot', title: 'Unsaved changes' }) : null,
        ),
        el('span', { className: 'rot-name-meta', textContent: weaponsOf(r.weapons, page.weapons).map((w) => w.name).join(', ') || 'No weapons' }),
        el(
          'span',
          { className: 'badges' },
          el('span', { className: `badge${MODE_BADGES[r.mode] ? ` badge-${MODE_BADGES[r.mode]}` : ''}`, textContent: MODE_LABELS[r.mode] ?? r.mode }),
          today ? el('span', { className: 'badge', textContent: today.replace('Today: ', '') + ' today' }) : null,
        ),
      );
      return el('li', {}, item);
    };
    let making = null;
    if (selected === NEW) {
      const item = el(
        'span',
        { className: 'rot-name-card rot-name-new' },
        el('span', { className: 'rot-name-top' }, el('span', { className: 'rot-name-text', textContent: tidy(draft.name) || 'New rule' })),
        el('span', { className: 'rot-name-meta', textContent: 'Not saved yet' }),
      );
      item.setAttribute('aria-current', 'true');
      making = el('li', {}, item);
    }
    return el(
      'aside',
      { className: 'card panel rot-side', ariaLabel: 'Weapon rules' },
      el('h2', { className: 'panel-title', textContent: 'Weapon rules' }),
      el('p', {
        className: 'rot-note',
        textContent: "When someone kills with a rule's weapon, the bot does what the rule says, a second or two after the kill.",
      }),
      page.rules.length === 0 && selected !== NEW ? el('p', { className: 'rot-note', textContent: 'No rules yet.' }) : null,
      el('ul', { className: 'rot-names' }, ...page.rules.map(card), making),
      add,
    );
  };

  // A row of buttons, one pressed, like the period picker.
  const choices = (name, options, chosen, pick) =>
    el(
      'div',
      { className: 'period rules-choices', role: 'group', ariaLabel: name },
      ...options.map(([value, text]) => {
        const choice = button(text, { disabled: busy });
        choice.setAttribute('aria-pressed', String(value === chosen));
        choice.dataset.focus = `${name}-${value}`;
        choice.addEventListener('click', () => pick(value));
        return choice;
      }),
    );

  const weaponsField = () => {
    const picked = weaponsOf(draft.weapons, page.weapons);
    const taken = takenWeapons(page.rules, page.weapons, selected === NEW ? null : selected);
    const pickedNames = new Set(picked.map((w) => w.name));
    const picker = el(
      'select',
      { className: 'finder-input rules-picker', ariaLabel: 'Add a weapon', disabled: busy },
      el('option', { value: '', textContent: 'Add a weapon…' }),
      ...weaponGroups(page.weapons).map((group) =>
        el(
          'optgroup',
          { label: KIND_NAMES[group.kind] ?? group.kind },
          ...group.weapons.map((w) => {
            const inRule = taken.get(w.name);
            return el('option', {
              value: w.name,
              textContent: inRule ? `${w.name} (in ${inRule})` : w.name,
              disabled: pickedNames.has(w.name) || inRule !== undefined,
            });
          }),
        ),
      ),
    );
    picker.dataset.focus = 'add-weapon';
    picker.addEventListener('change', () => {
      if (picker.value) addWeapon(picker.value);
    });
    return el(
      'div',
      { className: 'rules-field' },
      el('span', { className: 'rot-field-label', textContent: 'Weapons' }),
      picked.length === 0
        ? el('p', { className: 'rot-note rot-warn', textContent: 'No weapons yet. Pick at least one.' })
        : el(
            'ul',
            { className: 'rules-weapons' },
            ...picked.map((w) => {
              const out = button('×', { className: 'rot-icon-btn rules-weapon-remove', ariaLabel: `Take ${w.name} out`, title: 'Take it out', disabled: busy });
              out.addEventListener('click', () => removeWeapon(w));
              return el(
                'li',
                { className: 'rules-weapon' },
                el('span', { textContent: w.name }),
                el('span', { className: 'muted rules-weapon-kind', textContent: KIND_NAMES[w.kind] ?? w.kind }),
                out,
              );
            }),
          ),
      picker,
    );
  };

  // A message to type, with its count and how it shows in game.
  const messageField = ({ key, title, used, limit, parts, unused, hint }) => {
    const input = el('input', {
      className: 'finder-input lines-input rules-input',
      type: 'text',
      value: draft[key],
      maxLength: 500,
      spellcheck: true,
      autocomplete: 'off',
      id: `rules-${key}`,
      placeholder: hint,
    });
    input.dataset.focus = key;
    input.addEventListener('input', () => {
      draft[key] = input.value;
      update();
    });
    return el(
      'div',
      { className: `rules-field${used ? '' : ' rules-unused'}` },
      el('label', { className: 'rot-field-label', textContent: title, htmlFor: `rules-${key}` }),
      input,
      used ? null : el('p', { className: 'rot-note', textContent: unused }),
      preview(parts, key, limit),
    );
  };

  const preview = (parts, key, limit) => {
    const box = el('div', { className: 'lines-preview rules-preview' });
    box.dataset.role = `preview-${key}`;
    const over = parts.line.length > limit;
    box.append(
      el(
        'div',
        { className: 'rules-field-head' },
        el('span', { className: 'rot-field-label', textContent: 'In game' }),
        parts.line
          ? el('span', {
              className: `lines-count${over ? ' lines-count-over' : ''}`,
              textContent: `${parts.line.length}/${limit}`,
              title: "Characters in what you typed, of the most it can have: the game shows 200, and the bot's dimmed parts take the rest",
            })
          : null,
      ),
    );
    if (!parts.line) {
      box.append(el('p', { className: 'muted', textContent: 'Type it to see the message.' }));
      return box;
    }
    box.append(
      el(
        'p',
        { className: 'lines-message' },
        parts.before ? el('span', { className: 'lines-added', textContent: parts.before }) : null,
        el('span', { textContent: parts.line }),
        el('span', { className: 'lines-added', textContent: parts.after }),
      ),
    );
    if (over) box.append(el('p', { className: 'lines-problem', textContent: `${parts.line.length - limit} characters too long for the game.` }));
    return box;
  };

  const warningPreview = () => preview(warningParts(draft, page.after), 'warning', page.limits.warning);
  const kickPreview = () => preview(kickParts(draft, page.after), 'kick', page.limits.kick);

  // After typing: the previews, the problem, and whether there is anything to save. The rest stays as it is, so the
  // cursor stays put.
  const update = () => {
    content.querySelector('[data-role="preview-warning"]')?.replaceWith(warningPreview());
    content.querySelector('[data-role="preview-kick"]')?.replaceWith(kickPreview());
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
    const why = content.querySelector('[data-role="problem"]');
    if (why) why.textContent = changed ? (ruleProblem(draft, page.rules, page) ?? '') : '';
    content.querySelector('.rot-side')?.replaceWith(sideCard());
  };

  // What is wrong with the rule, while it has changes.
  const problemNote = (changed) => {
    const note = el('p', { className: 'rot-note rot-warn', role: 'status', textContent: changed ? (ruleProblem(draft, page.rules, page) ?? '') : '' });
    note.dataset.role = 'problem';
    return note;
  };

  const editorCard = () => {
    const current = rule();
    const changed = dirty();
    const status = el('span', { className: `rot-status${changed ? ' rot-status-dirty' : ''}`, textContent: changed ? 'Unsaved changes' : 'Saved' });
    status.dataset.role = 'status';
    const saveButton = button(selected === NEW ? 'Add rule' : 'Save', { className: 'btn btn-small rot-btn-primary', disabled: busy || !changed });
    saveButton.dataset.role = 'save';
    saveButton.addEventListener('click', save);
    const discardButton = button(selected === NEW ? 'Cancel' : 'Discard changes', { className: 'btn btn-ghost btn-small', disabled: busy || (!changed && selected !== NEW) });
    discardButton.dataset.role = 'discard';
    discardButton.addEventListener('click', discard);
    const removeButton = current ? button('Take out', { className: 'btn btn-ghost btn-small', disabled: busy }) : null;
    removeButton?.addEventListener('click', remove);

    const name = el('input', {
      className: 'rot-name-input',
      type: 'text',
      value: draft.name,
      maxLength: page.maxName,
      placeholder: 'Rule name, such as Humvee gunner',
      ariaLabel: 'Rule name',
      autocomplete: 'off',
    });
    name.dataset.focus = 'name';
    name.addEventListener('input', () => {
      draft.name = name.value;
      update();
    });
    const today = current ? todayText(current.today) : null;

    return el(
      'section',
      { className: 'card panel rot-editor', ariaLabel: `${label()} rule` },
      el(
        'div',
        { className: 'rot-editor-head' },
        el(
          'div',
          { className: 'rot-name-field' },
          el('span', { className: 'rot-field-label', textContent: 'Rule' }),
          name,
          el('p', { className: 'rot-name-note', textContent: [changedText(current), today].filter(Boolean).join(' · ') }),
        ),
        el('div', { className: 'rot-actions' }, status, saveButton, discardButton, removeButton),
      ),
      page.feed ? null : el('p', { className: 'rot-note rot-warn', textContent: "The bot doesn't take the kill feed, so it can't see kills: these rules do nothing until it does. See the bot's Weapon stats setup." }),
      el(
        'div',
        { className: 'rules-field' },
        el('span', { className: 'rot-field-label', textContent: 'What the bot does' }),
        choices('mode', MODES.map((m) => [m, MODE_LABELS[m]]), draft.mode, setMode),
        el('p', { className: 'rot-note', textContent: modeNote(draft.mode, draft.warnings) }),
        draft.mode === 'warn-kick'
          ? el(
              'div',
              { className: 'rules-warnings' },
              el('span', { className: 'rot-field-label', textContent: 'Warnings before the kick' }),
              choices(
                'warnings',
                Array.from({ length: page.maxWarnings }, (_, i) => [i + 1, String(i + 1)]),
                draft.warnings,
                setWarnings,
              ),
            )
          : null,
      ),
      weaponsField(),
      messageField({
        key: 'warning',
        title: 'Warning',
        used: warns(draft.mode),
        limit: page.limits.warning,
        parts: warningParts(draft, page.after),
        unused: 'Not sent with this mode. Kept for when you switch to Warn.',
        hint: 'Such as: No kills from the Humvee gun. It is not allowed on this server.',
      }),
      messageField({
        key: 'kick',
        title: 'Kick reason',
        used: kicks(draft.mode),
        limit: page.limits.kick,
        parts: kickParts(draft, page.after),
        unused: 'Not used with this mode. Kept for when you switch to Kick.',
        hint: 'Such as: Kills from the Humvee gun, which is not allowed on this server',
      }),
      problemNote(changed),
      el('p', {
        className: 'rot-note',
        textContent:
          'Kills within 30 seconds of the bot acting count as one offence, so one burst gets one warning. Offences count per rule and start again each day (UTC). Every warning and kick goes in the moderation log as done by the bot.',
      }),
    );
  };

  const emptyCard = () =>
    el(
      'section',
      { className: 'card panel rot-editor' },
      el('p', { textContent: 'No weapon rules. Add one with “+ New rule”.' }),
    );

  const render = (keep = null) => {
    const focused = document.activeElement?.dataset?.focus ?? keep;
    if (problem && !page) {
      content.replaceChildren(el('div', { className: 'card panel' }, el('p', { textContent: problem })));
      return;
    }
    if (!page) {
      content.replaceChildren(el('div', { className: 'card panel rot-loading' }, el('p', { className: 'muted', textContent: 'Loading the weapon rules…' })));
      return;
    }
    content.replaceChildren(el('div', { className: 'rot-workspace' }, sideCard(), draft ? editorCard() : emptyCard()));
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
      draft = null;
      problem = null;
      loadedAt = 0;
      render();
    },
    get dirty() {
      return dirty();
    },
  };
};
