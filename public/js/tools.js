import { clockHour, defaultLabel, discordParts, optionLabel, presetReasons, READ_ONLY_TOOLS, staffLabel, toolsFrom } from './format.js';
import { el } from './views.js';

// The staff page's admin tools: a form for each of the bot's staff commands, built from the definitions the bot sends.
// Pick-lists are filled from the bot's own suggestions, as in Discord; anything that changes the game or the records
// asks first; the bot's reply is shown underneath. The bot checks and runs each command exactly as the slash command.

// Discord's option types.
const STRING = 3;
const INTEGER = 4;
const BOOLEAN = 5;

// Wait this long after typing stops before asking the bot for suggestions.
const SUGGEST_DELAY_MS = 250;

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
// `only(tool)` picks the tools offered, such as only those for a player; every tool by default.
export const createTools = ({ root, call, onChanged, staff, only = () => true }) => {
  let tools = [];
  let current = null;
  // What staff picked or typed for the player in each tool, so it carries over when they switch tools.
  let playerValue = '';
  // The names of the choices last offered, by option and value, to show who a Steam ID is.
  const offered = new Map();

  const picker = el('select', { id: 'tool-picker', className: 'finder-input tool-picker' });
  const help = el('p', { className: 'section-note tool-help' });
  const form = el('form', { className: 'tool-form', noValidate: false });
  const output = el('div', { className: 'tool-output', role: 'status' });
  root.replaceChildren(
    el('label', { className: 'finder-label', htmlFor: 'tool-picker', textContent: 'Tool' }),
    picker,
    help,
    form,
    output,
  );

  const fieldId = (name) => `tool-${name}`;

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
  };

  // Who or what a picked value is: "Vex · 🔴 Valkyra · 7656…" under a Steam ID.
  const showHint = (option, input, hint) => {
    const name = offered.get(option.name)?.get(input.value);
    hint.textContent = name && name !== input.value ? `→ ${name}` : '';
  };

  const field = (o) => {
    const id = fieldId(o.name);
    const label = el('label', { htmlFor: id, className: 'tool-label', textContent: `${optionLabel(o.name)}${o.required ? '' : ' (optional)'}` });
    const note = el('p', { className: 'tool-note muted', textContent: o.description ?? '' });
    let input;
    if (o.choices) {
      input = el(
        'select',
        { id, name: o.name, required: Boolean(o.required) },
        ...(o.required ? [el('option', { value: '', textContent: 'Pick one', disabled: true, selected: true })] : [el('option', { value: '', textContent: '—' })]),
        ...o.choices.map((c) => el('option', { value: c.value, textContent: c.name })),
      );
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
          ...presets.map((r) =>
            el('button', {
              type: 'button',
              className: 'preset',
              textContent: r.label,
              title: r.text,
              onclick: () => {
                input.value = r.text;
                input.focus();
                input.setSelectionRange(r.text.length, r.text.length);
              },
            }),
          ),
        ),
      );
    }
    if (o.type === STRING && o.autocomplete && !o.choices) {
      const list = el('datalist', { id: `${id}-list` });
      const hint = el('p', { className: 'tool-hint' });
      input.setAttribute('list', list.id);
      input.placeholder = o.name === 'player' || o.name === 'steam_id' ? 'Type a name or Steam ID, then pick' : 'Type, then pick';
      let timer = 0;
      const later = () => {
        clearTimeout(timer);
        timer = setTimeout(() => suggest(o, input, list, hint).catch(() => undefined), SUGGEST_DELAY_MS);
      };
      input.addEventListener('input', () => {
        if (o.name === 'player' || o.name === 'steam_id') playerValue = input.value;
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

  const show = (key) => {
    current = tools.find((t) => t.key === key) ?? tools[0];
    if (!current) return;
    picker.value = current.key;
    help.textContent = current.description;
    const submit = el('button', { type: 'submit', className: 'btn btn-small tool-run', textContent: READ_ONLY_TOOLS.has(current.key) ? current.label : `${current.label}…` });
    form.replaceChildren(...current.options.map(field), submit);
    for (const name of ['player', 'steam_id']) {
      const input = form.elements.namedItem(name);
      if (input && playerValue) input.value = playerValue;
    }
  };

  picker.addEventListener('change', () => {
    output.replaceChildren();
    show(picker.value);
  });

  // What will happen, in words, for staff to confirm.
  const summary = (given) =>
    current.options
      .filter((o) => given[o.name] !== undefined)
      .map((o) => {
        const value = given[o.name];
        const picked = offered.get(o.name)?.get(value) ?? o.choices?.find((c) => c.value === value)?.name;
        const shown = o.type === BOOLEAN ? (value === 'true' ? 'On' : 'Off') : picked ? `${picked}` : value;
        return `${optionLabel(o.name)}: ${shown}`;
      })
      .join('\n');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!current || !form.reportValidity()) return;
    const given = values();
    if (!READ_ONLY_TOOLS.has(current.key) && !window.confirm(`${current.label}?\n\n${summary(given)}`)) return;
    const button = form.querySelector('.tool-run');
    button.disabled = true;
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
      button.disabled = false;
    }
  });

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
    // open, such as Kick or Ban, and otherwise Warn opens. The page brings the tools into view.
    use(key, steamId, name) {
      if (tools.length === 0) return;
      playerValue = steamId;
      for (const option of ['player', 'steam_id']) offered.set(option, new Map([...(offered.get(option) ?? []), [steamId, name]]));
      output.replaceChildren();
      const playerTool = current?.group === 'Players' && current.options.some((o) => o.name === 'player' || o.name === 'steam_id');
      show(key ?? (playerTool ? current.key : 'warn'));
      for (const option of ['player', 'steam_id']) {
        const input = form.elements.namedItem(option);
        if (input) input.dispatchEvent(new Event('input'));
      }
      const next = [...form.querySelectorAll('input, select, textarea')].find((i) => i.required && i.value === '');
      (next ?? picker).focus({ preventScroll: true });
    },
    get ready() {
      return tools.length > 0;
    },
  };
};
