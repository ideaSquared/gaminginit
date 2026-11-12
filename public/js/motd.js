import { ask } from './ask.js';
import { countText, linesOf, MAX_CHARS, MAX_LINES, outcomeText, previewStyle, readLine, RULES_TEMPLATE, sameMessage, textOf, validate } from './motdmodel.js';
import { el } from './views.js';

// The staff page's Welcome message tab: the popup players see when they join. Edit it one line to a line, watch the preview
// as it would look in game, and Apply: the bot checks it, and the server shows it from the next match. "Start from the
// website rules" fills the editor with the message the owner approved.
//
// `load()` and `send(body)` reach the bot (GET and POST /api/admin/motd) and resolve to { ok, status, json }.

// The page is read again when the tab is opened after this long, if nothing is being edited.
const STALE_MS = 60_000;
// How long a message stays.
const TOAST_MS = 6_000;

const button = (text, props = {}) => el('button', { type: 'button', textContent: text, ...props });

export const createMotd = ({ root, load, send }) => {
  // What the server has: { enabled, lines, revision }. `draft` is what staff are typing.
  let page = null;
  let draft = { enabled: true, text: '' };
  let loadedAt = 0;
  let loading = null;
  let problem = null;
  let busy = false;
  // Set when the server's message changed since this page read it: Apply stays off until it is read again (Reset).
  let behind = false;
  // What the last Apply did, until the next edit.
  let outcome = null;

  const announcer = el('p', { className: 'visually-hidden', role: 'status' });
  const toasts = el('div', { className: 'rot-toasts', ariaLive: 'polite' });
  const content = el('div', { className: 'rot motd' });
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

  const message = () => ({ enabled: draft.enabled, lines: linesOf(draft.text) });
  const dirty = () => page !== null && !sameMessage(message(), page);
  const problems = () => validate(message().lines);
  const canApply = () => page !== null && !busy && !behind && dirty() && problems().length === 0;

  window.addEventListener('beforeunload', (event) => {
    if (dirty()) event.preventDefault();
  });

  // --- Talking to the bot ---

  // Bumped by reset (signing out), so an answer that arrives after it is dropped.
  let generation = 0;

  const fill = () => {
    draft = { enabled: page.enabled, text: textOf(page.lines) };
  };

  // Takes what the bot sent as what the server has. The editor follows it unless staff had changed it.
  const adopt = (next, { force = false } = {}) => {
    const edited = dirty();
    page = next;
    loadedAt = Date.now();
    if (force || !edited) fill();
  };

  const refresh = async ({ force = false } = {}) => {
    const mine = generation;
    loading ??= (async () => {
      const answer = await load().catch(() => ({ ok: false, status: 0, json: null }));
      loading = null;
      if (mine !== generation) return false;
      if (!answer.ok) {
        problem =
          answer.status === 404
            ? 'The bot does not have the welcome message yet. Deploy the latest bot.'
            : (answer.json?.error ?? 'Could not load the welcome message. Trying again when you come back to this tab.');
        loadedAt = 0;
        render();
        return false;
      }
      problem = null;
      behind = false;
      adopt(answer.json, { force });
      render();
      return true;
    })();
    return loading;
  };

  // --- Actions ---

  const apply = async () => {
    if (!canApply()) return;
    const mine = generation;
    const sent = message();
    busy = true;
    outcome = null;
    update();
    try {
      const answer = await send({ ...sent, revision: page.revision }).catch(() => ({ ok: false, status: 0, json: null }));
      if (mine !== generation) return;
      if (!answer.ok) {
        toast(answer.json?.error ?? "Couldn't reach the bot. If it was a save, check before trying again.", 'error');
        if (answer.status === 409) behind = true;
        // The answer may have been lost on the way, with the save done: read it again, keeping what was typed.
        else if (!answer.status || answer.status >= 500) await refresh();
        return;
      }
      const done = outcomeText(answer.json?.outcome);
      outcome = done;
      toast(done);
      announce(done);
      // The bot sends the page as it is now, with the revision the next save needs. Without one, read it again.
      if (typeof answer.json?.revision === 'string') adopt(answer.json, { force: true });
      else await refresh({ force: true });
    } finally {
      if (mine === generation) {
        busy = false;
        render('apply');
      }
    }
  };

  // Puts the editor back to what the server has, read again now.
  const reset = async () => {
    if (busy) return;
    if (dirty() && !(await ask('Throw away your changes and load what the server has?', { yes: 'Reset', no: 'Keep editing', danger: true }))) return;
    outcome = null;
    await refresh({ force: true });
    render('text');
  };

  const useTemplate = async () => {
    const text = textOf(RULES_TEMPLATE);
    if (draft.text.trim() !== '' && draft.text !== text && !(await ask('Replace what is in the editor with the website rules?', { yes: 'Replace', no: 'Keep editing', danger: true }))) return;
    draft.text = text;
    outcome = null;
    render('text');
  };

  // --- Drawing ---

  const styled = (segment) => {
    const style = previewStyle(segment.style);
    const span = el('span', { textContent: segment.text });
    if (style === null) return span;
    if (style.fontSize) span.style.fontSize = `${style.fontSize}px`;
    if (style.bold) span.style.fontWeight = '800';
    if (style.italic) span.style.fontStyle = 'italic';
    if (style.color) span.style.color = style.color;
    return span;
  };

  // The popup as players see it, a row for each line with its number and how many of the 128 characters it shows.
  const previewRows = () => {
    const lines = message().lines;
    if (lines.length === 0) return [el('li', { className: 'motd-empty muted', textContent: 'Nothing to show yet.' })];
    return lines.map((line, i) => {
      const read = readLine(line);
      const bad = read.problems.length > 0;
      return el(
        'li',
        { className: `motd-row${bad ? ' motd-row-bad' : ''}` },
        el('span', { className: 'motd-num', textContent: String(i + 1) }),
        el('span', { className: 'motd-text' }, ...(read.segments.length === 0 ? [el('br')] : read.segments.map(styled))),
        el('span', { className: `motd-count${read.visible > MAX_CHARS ? ' lines-count-over' : ''}`, textContent: line === '' ? '' : countText(read.visible), title: 'Characters shown, not counting tags' }),
      );
    });
  };

  const problemItems = () => {
    const found = problems();
    return found.map((p) => el('li', { textContent: p.line === null ? p.problem : `Line ${p.line}: ${p.problem}` }));
  };

  // After typing: the preview, the problems, and whether there is anything to apply. The text box stays as it is, so the
  // cursor stays put.
  const update = () => {
    const changed = dirty();
    const rows = content.querySelector('[data-role="preview"]');
    rows?.replaceChildren(...previewRows());
    rows?.closest('.motd-popup')?.classList.toggle('motd-popup-off', !draft.enabled);
    const list = content.querySelector('[data-role="problems"]');
    if (list) {
      list.replaceChildren(...problemItems());
      list.hidden = list.children.length === 0;
    }
    const status = content.querySelector('[data-role="status"]');
    if (status) {
      status.textContent = busy ? 'Working…' : behind ? 'Changed elsewhere' : changed ? 'Unsaved changes' : (outcome ?? 'Saved');
      status.classList.toggle('rot-status-dirty', busy || behind || changed);
    }
    const applyButton = content.querySelector('[data-role="apply"]');
    if (applyButton) applyButton.disabled = !canApply();
    const resetButton = content.querySelector('[data-role="reset"]');
    if (resetButton) resetButton.disabled = busy || (!changed && !behind);
    const total = content.querySelector('[data-role="total"]');
    if (total) {
      const n = message().lines.length;
      total.textContent = `${n} / ${MAX_LINES} lines`;
      total.classList.toggle('lines-count-over', n > MAX_LINES);
    }
  };

  const editorCard = () => {
    const status = el('span', { className: 'rot-status', textContent: 'Saved' });
    status.dataset.role = 'status';
    const applyButton = button('Apply', { className: 'btn btn-small rot-btn-primary' });
    applyButton.dataset.role = 'apply';
    applyButton.dataset.focus = 'apply';
    applyButton.addEventListener('click', apply);
    const resetButton = button('Reset', { className: 'btn btn-ghost btn-small', title: 'Load what the server has' });
    resetButton.dataset.role = 'reset';
    resetButton.addEventListener('click', reset);

    const enabled = el('input', { type: 'checkbox', checked: draft.enabled, disabled: false });
    enabled.dataset.focus = 'enabled';
    enabled.addEventListener('change', () => {
      draft.enabled = enabled.checked;
      outcome = null;
      update();
    });

    const text = el('textarea', {
      className: 'tool-input motd-input',
      value: draft.text,
      rows: 16,
      spellcheck: false,
      autocomplete: 'off',
      ariaLabel: 'Welcome message, one line for each line of the popup',
      placeholder: '<Header>Welcome</>\n<Bold>Rule 1</> - and what it means',
    });
    text.dataset.focus = 'text';
    text.addEventListener('input', () => {
      draft.text = text.value;
      outcome = null;
      update();
    });

    const total = el('span', { className: 'muted motd-total' });
    total.dataset.role = 'total';
    const preview = el('ol', { className: 'motd-rows' });
    preview.dataset.role = 'preview';
    const found = el('ul', { className: 'motd-problems', role: 'status' });
    found.dataset.role = 'problems';

    const card = el(
      'section',
      { className: 'card panel rot-editor', ariaLabel: 'Welcome message' },
      el(
        'div',
        { className: 'rot-editor-head' },
        el(
          'div',
          { className: 'rot-name-field' },
          el('span', { className: 'rot-field-label', textContent: 'Server' }),
          el('h3', { className: 'chat-list-name', textContent: 'Welcome message' }),
          el('p', { className: 'rot-name-note', textContent: 'The popup players see when they join. A change shows from the next match.' }),
        ),
        el('div', { className: 'rot-actions' }, status, applyButton, resetButton),
      ),
      behind
        ? el('p', { className: 'rot-note rot-warn', role: 'alert', textContent: 'The welcome message was changed somewhere else since you opened it. Press Reset to load it. Your changes here will be lost.' })
        : null,
      el('label', { className: 'motd-toggle' }, enabled, el('span', { textContent: 'Enabled: show it to players' })),
      el(
        'div',
        { className: 'motd-grid' },
        el(
          'div',
          { className: 'rules-field' },
          el('div', { className: 'motd-field-head' }, el('label', { className: 'rot-field-label', textContent: 'Message, one line per popup line' }), total),
          text,
          el('div', { className: 'motd-actions' }, button('Start from the website rules', { className: 'btn btn-ghost btn-small', onclick: useTemplate })),
        ),
        el(
          'div',
          { className: 'rules-field' },
          el('span', { className: 'rot-field-label', textContent: 'Preview' }),
          el('div', { className: `motd-popup${draft.enabled ? '' : ' motd-popup-off'}` }, preview),
          el('p', { className: 'rot-note', textContent: 'An approximation of the popup. Numbers on the right are characters shown out of 128.' }),
        ),
      ),
      found,
      el(
        'details',
        { className: 'motd-help' },
        el('summary', { textContent: 'How to write it' }),
        el(
          'ul',
          { className: 'rot-note' },
          el('li', { textContent: 'An empty line is a blank line in the popup.' }),
          el('li', {}, 'Tags: ', el('code', { textContent: '<Header>…</>' }), ', ', el('code', { textContent: '<Bold>…</>' }), ', ', el('code', { textContent: '<Italic>…</>' }), ' and ', el('code', { textContent: '<text color="#RRGGBB" size="8 to 24" fontface="Bold or Italic">…</>' }), '.'),
          el('li', { textContent: 'Close every tag with </>. Tags can’t be inside each other. Header takes no attributes. Any other tag, links too, is refused.' }),
          el('li', {}, 'To show ', el('code', { textContent: '< > & "' }), ' write ', el('code', { textContent: '&lt; &gt; &amp; &quot;' }), '.'),
          el('li', { textContent: `At most ${MAX_LINES} lines and ${MAX_CHARS} characters in a line. Tags aren’t counted; each of those four counts as one.` }),
        ),
      ),
    );
    return card;
  };

  const render = (keep = null) => {
    const focused = keep ?? document.activeElement?.dataset?.focus ?? null;
    if (problem && !page) {
      content.replaceChildren(el('div', { className: 'card panel' }, el('p', { textContent: problem })));
      return;
    }
    if (!page) {
      content.replaceChildren(el('div', { className: 'card panel rot-loading' }, el('p', { className: 'muted', textContent: 'Loading the welcome message…' })));
      return;
    }
    content.replaceChildren(...(problem ? [el('p', { className: 'rot-note rot-warn', role: 'alert', textContent: problem })] : []), editorCard());
    update();
    if (focused) content.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  };

  return {
    // When the tab is opened: loads, or loads again when what it has is old and nothing is being edited.
    show() {
      if (!page) refresh();
      else if (!dirty() && !busy && Date.now() - loadedAt > STALE_MS) refresh();
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
      behind = false;
      loading = null;
      page = null;
      draft = { enabled: true, text: '' };
      outcome = null;
      problem = null;
      loadedAt = 0;
      render();
    },
    get dirty() {
      return dirty();
    },
  };
};
