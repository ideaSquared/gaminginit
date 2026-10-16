import { actionLabel, asksFirst, clockHour, defaultLabel, discordParts, optionLabel, presetReasons, READ_ONLY_TOOLS, staffLabel, teamOptions, toolsFrom } from './format.js';
import { el } from './views.js';

// The staff page's admin tools: a form for each of the bot's staff commands, built from the definitions the bot sends.
// Pick-lists are filled from the bot's own suggestions, as in Discord, and a short list to pick from (a ban's length) is a
// row of buttons. The button says what it does ("Ban Vex for 3 days"). Anything that changes the game or the records,
// but a warning, asks first, in place: the button asks again, with what will happen. The bot's reply is shown
// underneath. The bot checks and runs each command exactly as the slash command.

// Discord's option types.
const STRING = 3;
const INTEGER = 4;
const BOOLEAN = 5;

// Wait this long after typing stops before asking the bot for suggestions.
const SUGGEST_DELAY_MS = 250;

// A required choice with this many options or fewer is a row of buttons, not a drop-down.
const CHOICE_BUTTONS = 6;

// Tools whose confirm button is red: they take a player off the server, or delete something.
const DANGER_TOOLS = new Set(['kick', 'ban', 'removematch', 'rotations:delete']);

// In the reader's own time: "Fri 3 Oct, 21:40".
const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });

// Text from the bot, with its Discord markdown shown as it would be in Discord. `staff` names Discord users.
const discordNodes = (text, staff) =>
  discordParts(text).map((part) => {
    if (part.type === 'strong') return el('strong', { textContent: part.text });
    if (part.type === 'code') return el('code', { textContent: part.text });
    if (part.type === 'link') return el('a', { href: part.href, rel: 'noopener noreferrer', target: '_blank', textContent: part.text });
    if (part.type === 'time') return el('time', { dateTime: new Date(part.at).toISOString(), textContent: when.format(part.at) });
    if (part.type === 'user') return staff[part.id] ? staffLabel(staff[part.id]) : `Discord user ${part.id}`;
    if (part.type === 'role') return '@role';
    return part.text;
  });

// A reply from the bot, as Discord would show it. The History tab shows a player's record with it too.
export const replyNodes = (reply, staff) => [
  ...(reply.content ? [el('p', { className: 'reply-text' }, ...discordNodes(reply.content, staff))] : []),
  ...(reply.embeds ?? []).map((embed) =>
    el(
      'div',
      { className: 'reply-embed' },
      el(
        'p',
        { className: 'reply-title' },
        /^https?:\/\//.test(embed.url ?? '') ? el('a', { href: embed.url, rel: 'noopener noreferrer', target: '_blank' }, ...discordNodes(embed.title, staff)) : el('strong', {}, ...discordNodes(embed.title, staff)),
      ),
      embed.description ? el('p', { className: 'reply-text' }, ...discordNodes(embed.description, staff)) : null,
      ...(embed.fields ?? []).map((f) =>
        el('div', { className: 'reply-field' }, el('p', { className: 'reply-field-name', textContent: f.name }), el('p', { className: 'reply-text' }, ...discordNodes(f.value, staff))),
      ),
      embed.footer?.text ? el('p', { className: 'reply-footer muted', textContent: embed.footer.text }) : null,
    ),
  ),
];

// `call(path, body)` posts to the bot's staff API and resolves to { ok, json }. `onChanged()` is called after a command
// that changes something, so the page can load the records again. `staff()` gives the current Discord user names.
// `only(tool)` picks the tools offered, such as only those for a player; every tool by default. `idPrefix` starts the
// ids of its fields, so two sets of tools can be on one page. `teamOf(steamId)` gives a player's team in game now, or
// null, so a player can't be moved to the team they are on. `forPlayer`: the tools are for the player they are opened
// with (see `use`), as in a player's panel, so there is no tool to pick and no player to fill in.
export const createTools = ({ root, call, onChanged, staff, only = () => true, idPrefix = 'tool', teamOf = () => null, forPlayer = false }) => {
  let tools = [];
  let current = null;
  // What staff picked or typed for the player in each tool, so it carries over when they switch tools.
  let playerValue = '';
  // The names of the choices last offered, by option and value, to show who a Steam ID is.
  const offered = new Map();
  // Whether the button is asking again, before a tool that changes something runs.
  let confirming = false;

  const picker = el('select', { id: `${idPrefix}-picker`, className: 'finder-input tool-picker' });
  const help = el('p', { className: 'section-note tool-help' });
  const form = el('form', { className: 'tool-form', noValidate: false });
  const output = el('div', { className: 'tool-output', role: 'status' });
  root.replaceChildren(
    ...(forPlayer ? [] : [el('label', { className: 'finder-label', htmlFor: picker.id, textContent: 'Tool' }), picker, help]),
    form,
    output,
  );

  const fieldId = (name) => `${idPrefix}-${name}`;
  const isPlayer = (o) => o.name === 'player' || o.name === 'steam_id';
  const asButtons = (o) => Boolean(o.choices) && Boolean(o.required) && o.choices.length >= 2 && o.choices.length <= CHOICE_BUTTONS && o.name !== 'team';

  const values = () =>
    Object.fromEntries(
      current.options.flatMap((o) => {
        const input = form.elements.namedItem(o.name);
        const value = input?.value?.trim() ?? '';
        return value === '' ? [] : [[o.name, value]];
      }),
    );

  const suggest = async (option, input, list, hint) => {
    const options = { ...values(), ...(current.subcommand ? { subcommand: current.subcommand } : {}) };
    const answer = await call('admin/suggest', { name: current.name, options, focused: option.name });
    const choices = answer.ok ? (answer.json.choices ?? []) : [];
    const names = new Map(choices.map((c) => [c.value, c.name]));
    offered.set(option.name, new Map([...(offered.get(option.name) ?? []), ...names]));
    list.replaceChildren(...choices.map((c) => el('option', { value: c.value, label: c.name })));
    showHint(option, input, hint);
    showRun();
  };

  // Who or what a picked value is: "Vex · 🔴 Valkyra · 7656…" under a Steam ID.
  const showHint = (option, input, hint) => {
    const name = offered.get(option.name)?.get(input.value);
    hint.textContent = name && name !== input.value ? `→ ${name}` : '';
  };

  // Moving a player: the team they are on now is marked and can't be picked (see teamOptions). A team picked before
  // that is theirs now is cleared.
  const markTeam = () => {
    const option = current?.options.find((o) => o.name === 'team' && o.choices);
    const select = form.elements.namedItem('team');
    const player = form.elements.namedItem('player');
    if (!option || !select || !player) return;
    for (const { value, name, disabled } of teamOptions(option.choices, teamOf(player.value.trim()))) {
      const node = [...select.options].find((n) => n.value === value);
      if (!node) continue;
      node.textContent = name;
      node.disabled = disabled;
    }
    if (select.value !== '' && select.selectedOptions[0]?.disabled) select.value = '';
  };

  // The player's name, as picked, for the button: "Ban Vex". Null until it is known.
  const playerName = () => {
    const option = current.options.find(isPlayer);
    const value = option ? (form.elements.namedItem(option.name)?.value.trim() ?? '') : '';
    return offered.get(option?.name)?.get(value)?.split(' · ')[0] ?? null;
  };

  // The name of the length or team picked, for the button: "for 3 days", "to Manticore".
  const choiceName = () => {
    const option = current.options.find((o) => (o.name === 'duration' || o.name === 'team') && o.choices);
    const value = option ? (form.elements.namedItem(option.name)?.value ?? '') : '';
    return option?.choices.find((c) => c.value === value)?.name ?? null;
  };

  // What the button says: what the tool will do, in words, when the page can say it, or the tool's own label.
  const runLabel = () => actionLabel(current.key, playerName(), choiceName()) ?? (asksFirst(current.key) ? `${current.label}…` : current.label);

  const showRun = () => {
    const run = form.querySelector('.tool-run');
    if (run && current) run.textContent = runLabel();
  };

  // A reason picked from the presets is marked, until the words are changed.
  const markPresets = (input) => {
    for (const b of input.closest('.tool-field')?.querySelectorAll('.preset') ?? []) b.setAttribute('aria-pressed', String(b.title === input.value));
  };

  const field = (o) => {
    const id = fieldId(o.name);
    // The player the tools are for is already picked.
    if (forPlayer && isPlayer(o)) return el('input', { type: 'hidden', id, name: o.name, value: playerValue });
    const labelText = `${optionLabel(o.name)}${o.required ? '' : ' (optional)'}`;
    const note = el('p', { className: 'tool-note muted', textContent: o.description ?? '' });
    if (asButtons(o)) {
      // A row of buttons to pick one from, such as a ban's length. With the keyboard, the arrows move between them, and
      // on a player's panel 1, 2, 3 … pick them.
      const label = el('p', { className: 'tool-label', id: `${id}-label` }, labelText, forPlayer ? el('span', { className: 'tool-keys', textContent: ` · keys 1–${o.choices.length}` }) : null);
      const group = el(
        'div',
        { className: 'choices', id, role: 'radiogroup' },
        ...o.choices.map((c) => el('label', { className: 'choice' }, el('input', { type: 'radio', name: o.name, value: c.value, required: true }), el('span', { textContent: c.name }))),
      );
      group.setAttribute('aria-labelledby', label.id);
      group.setAttribute('aria-required', 'true');
      return el('div', { className: 'tool-field' }, label, group, ...(o.description ? [note] : []));
    }
    const label = el('label', { htmlFor: id, className: 'tool-label', textContent: labelText });
    let input;
    if (o.choices) {
      input = el(
        'select',
        { id, name: o.name, required: Boolean(o.required) },
        ...(o.required ? [el('option', { value: '', textContent: 'Pick one', disabled: true, selected: true })] : [el('option', { value: '', textContent: '—' })]),
        ...o.choices.map((c) => el('option', { value: c.value, textContent: c.name })),
      );
      // The player may have changed team since the form was drawn.
      if (o.name === 'team') input.addEventListener('focus', markTeam);
    } else if (o.type === BOOLEAN) {
      input = el(
        'select',
        { id, name: o.name, required: Boolean(o.required) },
        el('option', { value: '', textContent: o.required ? 'Pick one' : defaultLabel(o.description) }),
        el('option', { value: 'true', textContent: 'On' }),
        el('option', { value: 'false', textContent: 'Off' }),
      );
    } else if (o.type === INTEGER) {
      input = el('input', { id, name: o.name, type: 'number', step: 1, required: Boolean(o.required), ...(o.min_value !== undefined ? { min: o.min_value } : {}), ...(o.max_value !== undefined ? { max: o.max_value } : {}) });
    } else if (o.name === 'message' || o.name === 'reason') {
      input = el('textarea', { id, name: o.name, rows: 2, required: Boolean(o.required), ...(o.max_length ? { maxLength: o.max_length } : {}) });
    } else {
      input = el('input', { id, name: o.name, type: 'text', autocomplete: 'off', spellcheck: false, required: Boolean(o.required), ...(o.max_length ? { maxLength: o.max_length } : {}) });
    }
    input.classList.add('finder-input', 'tool-input');
    const parts = [label, input];
    // Reasons to pick for a warning, kick or ban, to change before sending if need be.
    const presets = presetReasons(current.key, o.name);
    if (presets.length > 0) {
      parts.push(
        el(
          'div',
          { className: 'presets', role: 'group', ariaLabel: `Pick a ${o.name === 'message' ? 'message' : 'reason'}` },
          ...presets.map((r) => {
            const b = el('button', {
              type: 'button',
              className: 'preset',
              textContent: r.label,
              title: r.text,
              onclick: () => {
                input.value = r.text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
                input.setSelectionRange(r.text.length, r.text.length);
              },
            });
            b.setAttribute('aria-pressed', 'false');
            return b;
          }),
        ),
      );
      input.addEventListener('input', () => markPresets(input));
    }
    if (o.type === STRING && o.autocomplete && !o.choices) {
      const list = el('datalist', { id: `${id}-list` });
      const hint = el('p', { className: 'tool-hint' });
      input.setAttribute('list', list.id);
      input.placeholder = isPlayer(o) ? 'Type a name or Steam ID, then pick' : 'Type, then pick';
      let timer = 0;
      const later = () => {
        clearTimeout(timer);
        timer = setTimeout(() => suggest(o, input, list, hint).catch(() => undefined), SUGGEST_DELAY_MS);
      };
      input.addEventListener('input', () => {
        if (isPlayer(o)) playerValue = input.value;
        if (o.name === 'player') markTeam();
        showHint(o, input, hint);
        later();
      });
      input.addEventListener('focus', later);
      parts.push(list, hint);
    }
    if (o.description) parts.push(note);
    if (o.type === STRING && o.max_length) parts.push(el('p', { className: 'tool-note muted', textContent: `Up to ${o.max_length} characters.` }));
    return el('div', { className: 'tool-field' }, ...parts);
  };

  // Asking again, in place of the button: what will happen, then Confirm or Back.
  const confirmBox = el('div', { className: 'tool-confirm', hidden: true });

  // Back to the button, as when staff go back or change anything in the form.
  const stopConfirming = ({ focus = false } = {}) => {
    if (!confirming) return;
    confirming = false;
    confirmBox.hidden = true;
    const run = form.querySelector('.tool-run');
    run.hidden = false;
    if (focus) run.focus();
  };

  const show = (key) => {
    current = tools.find((t) => t.key === key) ?? tools[0];
    if (!current) return;
    confirming = false;
    confirmBox.hidden = true;
    picker.value = current.key;
    help.textContent = current.description;
    const submit = el('button', { type: 'submit', className: 'btn btn-small tool-run' });
    form.replaceChildren(...current.options.map(field), submit, confirmBox);
    for (const option of current.options.filter(isPlayer)) {
      const input = form.elements.namedItem(option.name);
      if (input && playerValue) input.value = playerValue;
    }
    markTeam();
    showRun();
  };

  picker.addEventListener('change', () => {
    output.replaceChildren();
    show(picker.value);
  });

  // Anything changed while the button asks again goes back to the button: what is confirmed is what is shown.
  for (const type of ['input', 'change']) {
    form.addEventListener(type, () => {
      stopConfirming();
      showRun();
    });
  }

  // What will happen, in words, for staff to confirm.
  const summary = (given) =>
    current.options
      .filter((o) => given[o.name] !== undefined && !(forPlayer && isPlayer(o)))
      .map((o) => {
        const value = given[o.name];
        const picked = offered.get(o.name)?.get(value) ?? o.choices?.find((c) => c.value === value)?.name;
        const shown = o.type === BOOLEAN ? (value === 'true' ? 'On' : 'Off') : picked ? `${picked}` : value;
        return `${optionLabel(o.name)}: ${shown}`;
      });

  const askAgain = (given) => {
    confirming = true;
    const yes = el('button', { type: 'submit', className: `btn btn-small ${DANGER_TOOLS.has(current.key) ? 'btn-danger' : 'tool-run-confirm'}`, textContent: 'Confirm' });
    confirmBox.replaceChildren(
      el('p', { className: 'tool-confirm-question' }, el('strong', { textContent: `${runLabel().replace(/…$/, '')}?` })),
      el('ul', { className: 'tool-summary' }, ...summary(given).map((line) => el('li', { textContent: line }))),
      el('div', { className: 'tool-confirm-actions' }, yes, el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: 'Back', onclick: () => stopConfirming({ focus: true }) })),
    );
    form.querySelector('.tool-run').hidden = true;
    confirmBox.hidden = false;
    yes.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!current || !form.reportValidity()) return;
    const given = values();
    if (asksFirst(current.key) && !confirming) {
      askAgain(given);
      return;
    }
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    for (const b of buttons) b.disabled = true;
    output.replaceChildren(el('p', { className: 'muted', textContent: 'Working…' }));
    try {
      const options = { ...given, ...(current.subcommand ? { subcommand: current.subcommand } : {}) };
      const answer = await call('admin/command', { name: current.name, options });
      if (!answer.ok) {
        output.replaceChildren(el('p', { className: 'tool-error', textContent: answer.json?.error ?? 'The bot did not answer. Check before trying again.' }));
        return;
      }
      output.replaceChildren(...replyNodes(answer.json, staff()));
      if (!READ_ONLY_TOOLS.has(current.key)) onChanged();
    } catch {
      output.replaceChildren(el('p', { className: 'tool-error', textContent: 'Could not reach the bot. If it was an action, check before trying again.' }));
    } finally {
      // A disabled button loses keyboard focus: it goes back to the button, unless staff moved on meanwhile.
      const lost = document.activeElement === null || document.activeElement === document.body || form.contains(document.activeElement);
      for (const b of buttons) b.disabled = false;
      stopConfirming();
      if (lost) form.querySelector('.tool-run').focus({ preventScroll: true });
    }
  });

  // The first required field not filled in yet, to start on: the first of a row of buttons, or the box.
  const firstEmpty = () => {
    const option = current.options.find((o) => o.required && !(forPlayer && isPlayer(o)) && (form.elements.namedItem(o.name)?.value ?? '') === '');
    if (!option) return null;
    const input = form.elements.namedItem(option.name);
    return input instanceof RadioNodeList ? input[0] : input;
  };

  return {
    // The bot's staff command definitions.
    setCommands(definitions) {
      tools = toolsFrom(definitions).filter(only);
      const groups = [...new Set(tools.map((t) => t.group))];
      picker.replaceChildren(
        ...groups.map((group) => el('optgroup', { label: group }, ...tools.filter((t) => t.group === group).map((t) => el('option', { value: t.key, textContent: t.label })))),
      );
      show(current?.key ?? tools[0]?.key);
    },
    // Opens a tool with a player already picked, as from a row's button. With no `key`, the player tool open now stays
    // open, such as Kick or Ban, and otherwise Warn opens. `reason`, one of the preset reasons' labels, starts the
    // message or reason with it. Focus goes to the first thing still to fill in, or to the button. The page brings the
    // tools into view.
    use(key, steamId, name, { reason = null } = {}) {
      if (tools.length === 0) return;
      playerValue = steamId;
      for (const option of ['player', 'steam_id']) offered.set(option, new Map([...(offered.get(option) ?? []), [steamId, name]]));
      output.replaceChildren();
      const playerTool = current?.group === 'Players' && current.options.some(isPlayer);
      show(key ?? (playerTool ? current.key : 'warn'));
      for (const option of current.options.filter(isPlayer)) form.elements.namedItem(option.name)?.dispatchEvent(new Event('input', { bubbles: true }));
      for (const option of current.options) {
        const preset = reason && presetReasons(current.key, option.name).find((r) => r.label === reason);
        const input = form.elements.namedItem(option.name);
        if (!preset || !input || input.value !== '') continue;
        input.value = preset.text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      (firstEmpty() ?? (forPlayer ? form.querySelector('.tool-run') : picker)).focus({ preventScroll: true });
    },
    // Opens a tool with nothing filled in, such as from the command search, at the first thing to fill in.
    open(key) {
      if (tools.length === 0) return;
      output.replaceChildren();
      show(key);
      (firstEmpty() ?? form.querySelector('.tool-run')).focus({ preventScroll: true });
    },
    // Every tool, as { key, label, group }, in order: for the command search.
    get list() {
      return tools.map(({ key, label, group }) => ({ key, label, group }));
    },
    // Picks the `n`th (from 1) of the first row of buttons, such as a ban's length, and goes to the button. False when
    // there is no such row, or no such button.
    pick(n) {
      const radio = form.querySelectorAll('.choices')[0]?.querySelectorAll('input[type="radio"]')[n - 1];
      if (!radio) return false;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      form.querySelector('.tool-run').focus();
      return true;
    },
    // The tool open now, such as 'ban'.
    get key() {
      return current?.key ?? null;
    },
    get ready() {
      return tools.length > 0;
    },
  };
};
