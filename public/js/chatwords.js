import { clockHour } from './format.js';
import { canAdd, countText, switchNote, tidyWord, wordButton, wordGroups, wordProblem } from './chatmodel.js';
import { el } from './views.js';

// The staff page's Chat filter tab: the word lists the bot's chat moderation uses. Pick a list on the left, add words to
// it, take words out (a starter word taken out is kept, struck through, so it can be put back) and search it. Unlike the
// other editors each change is sent as it is made and the bot uses it from its next check, so there is nothing to save.
//
// `load()` and `send(body)` reach the bot (GET and POST /api/admin/chatwords) and resolve to { ok, status, json }.

// The page is read again when the tab is opened after this long.
const STALE_MS = 60_000;
// How long a message stays.
const TOAST_MS = 6_000;

const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });

const button = (text, props = {}) => el('button', { type: 'button', textContent: text, ...props });

export const createChatWords = ({ root, load, send }) => {
  let page = null;
  let loadedAt = 0;
  let loading = null;
  let problem = null;
  let selected = 'racism';
  let busy = false;
  // What is typed in the add box and the search box, kept while the page is drawn again.
  let typed = '';
  let query = '';

  const announcer = el('p', { className: 'visually-hidden', role: 'status' });
  const toasts = el('div', { className: 'rot-toasts', ariaLive: 'polite' });
  const content = el('div', { className: 'rot rules chat-words' });
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

  const list = () => page?.lists.find((l) => l.id === selected) ?? page?.lists[0] ?? null;

  // --- Talking to the bot ---

  // Bumped by reset (signing out), so an answer that arrives after it is dropped.
  let generation = 0;

  const adopt = (next) => {
    page = next;
    loadedAt = Date.now();
    if (!page.lists.some((l) => l.id === selected)) selected = page.lists[0]?.id ?? 'racism';
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
            ? 'The bot does not have the chat filter yet. Deploy the latest bot.'
            : (answer.json?.error ?? 'Could not load the chat filter. Trying again when you come back to this tab.');
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

  // Sends a change; the bot sends the page as it is now. Returns whether it worked.
  const change = async (body, done) => {
    if (busy) return false;
    const mine = generation;
    busy = true;
    lock(true);
    try {
      const answer = await send(body).catch(() => ({ ok: false, json: null }));
      if (mine !== generation) return false;
      if (!answer.ok) {
        toast(answer.json?.error ?? "Couldn't reach the bot. If it was a change, check before trying again.", 'error');
        return false;
      }
      adopt(answer.json);
      toast(done);
      announce(done);
      return true;
    } finally {
      if (mine === generation) {
        busy = false;
        lock(false);
        render();
      }
    }
  };

  // While a change is on its way the tab can't be used, so a second click can't send another.
  const lock = (on) => {
    content.classList.toggle('rot-busy', on);
    for (const part of content.querySelectorAll('.rot-workspace')) part.inert = on;
  };

  // --- Actions ---

  const add = async () => {
    const current = list();
    if (!current || !canAdd(typed)) return;
    const why = wordProblem(typed, current, page);
    if (why) {
      toast(why, 'error');
      return;
    }
    const word = typed;
    if (await change({ action: 'add', list: current.id, word }, `Added "${tidyWord(word)}". The bot uses it from its next check.`)) {
      typed = '';
      render('word');
    }
  };

  const act = (row) => {
    const current = list();
    const { action } = wordButton(row);
    change(
      { action, list: current.id, word: row.word },
      action === 'restore' ? `Put "${row.word}" back.` : `Took "${row.word}" out. The bot stops using it from its next check.`,
    );
  };

  const select = (id) => {
    if (id === selected) return;
    selected = id;
    typed = '';
    query = '';
    render();
    if (window.matchMedia('(max-width: 899px)').matches) content.querySelector('.rot-editor')?.scrollIntoView({ block: 'start' });
  };

  // --- Drawing ---

  const sideCard = () =>
    el(
      'aside',
      { className: 'card panel rot-side', ariaLabel: 'Word lists' },
      el('h2', { className: 'panel-title', textContent: 'Chat filter' }),
      el('p', {
        className: 'rot-note',
        textContent: 'The bot reads the game’s chat each minute. A line with a word from a list is acted on as the list says. Changes work from the next check.',
      }),
      el(
        'ul',
        { className: 'rot-names' },
        ...page.lists.map((l) => {
          const on = l.id === selected;
          const item = button('', { className: 'rot-name-card' });
          if (on) item.setAttribute('aria-current', 'true');
          item.addEventListener('click', () => select(l.id));
          item.append(
            el('span', { className: 'rot-name-top' }, el('span', { className: 'rot-name-text', textContent: l.name })),
            el('span', { className: 'rot-name-meta', textContent: countText(l) }),
          );
          return el('li', {}, item);
        }),
      ),
    );

  const wordPill = (row) => {
    const { text, label } = wordButton(row);
    const pill = el('li', { className: `rules-weapon chat-word${row.kind === 'removed' ? ' chat-word-removed' : ''}` }, el('span', { textContent: row.word }));
    const control = button(text, {
      className: row.kind === 'removed' ? 'btn btn-ghost btn-small' : 'rot-icon-btn rules-weapon-remove',
      ariaLabel: label,
      title: row.kind === 'removed' ? 'Use this starter word again' : row.kind === 'added' ? 'Take it off the list' : 'Take it out: the bot keeps it as an exclusion, so it can be put back',
      disabled: busy,
    });
    control.addEventListener('click', () => act(row));
    pill.append(control);
    return pill;
  };

  const groupsView = (current) =>
    wordGroups(current, query).map((group) =>
      el(
        'div',
        { className: 'rules-field chat-group' },
        el('span', { className: 'rot-field-label', textContent: `${group.title} (${group.words.length})` }),
        group.words.length === 0
          ? el('p', { className: 'rot-note', textContent: query ? 'No match.' : group.title === 'Added by staff' ? 'None yet.' : 'None.' })
          : el('ul', { className: 'rules-weapons chat-words-list' }, ...group.words.map(wordPill)),
      ),
    );

  const editorCard = () => {
    const current = list();
    const note = switchNote(page);
    const input = el('input', {
      className: 'finder-input rules-input chat-add-input',
      type: 'text',
      value: typed,
      maxLength: page.maxWord + 20,
      autocomplete: 'off',
      spellcheck: false,
      ariaLabel: `Add a word to the ${current.name} list`,
      placeholder: current.id === 'allow' ? 'An ordinary word, such as scunthorpe' : 'A word or phrase to add',
    });
    input.dataset.focus = 'word';
    const addButton = button('Add', { className: 'btn btn-small rot-btn-primary', disabled: busy || !canAdd(typed) });
    input.addEventListener('input', () => {
      typed = input.value;
      addButton.disabled = busy || !canAdd(typed);
      why.textContent = canAdd(typed) ? (wordProblem(typed, current, page) ?? '') : '';
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        add();
      }
    });
    addButton.addEventListener('click', add);
    const why = el('p', { className: 'rot-note rot-warn', role: 'status', textContent: canAdd(typed) ? (wordProblem(typed, current, page) ?? '') : '' });

    const search = el('input', {
      className: 'finder-input rules-input chat-search',
      type: 'search',
      value: query,
      autocomplete: 'off',
      ariaLabel: `Search the ${current.name} list`,
      placeholder: 'Search the list',
    });
    search.dataset.focus = 'search';
    const groups = el('div', { className: 'chat-groups' }, ...groupsView(current));
    search.addEventListener('input', () => {
      query = search.value;
      groups.replaceChildren(...groupsView(current));
    });

    return el(
      'section',
      { className: 'card panel rot-editor', ariaLabel: `${current.name} list` },
      el(
        'div',
        { className: 'rot-editor-head' },
        el(
          'div',
          { className: 'rot-name-field' },
          el('span', { className: 'rot-field-label', textContent: 'List' }),
          el('h3', { className: 'chat-list-name', textContent: current.name }),
          el('p', {
            className: 'rot-name-note',
            textContent: [countText(current), page.changed ? `Changed by ${page.changed.byName || 'staff'}, ${when.format(new Date(page.changed.at))}` : 'Starter words only'].join(' · '),
          }),
        ),
      ),
      note ? el('p', { className: 'rot-note rot-warn', textContent: note }) : null,
      el('p', { className: 'rot-note', textContent: current.note }),
      el(
        'div',
        { className: 'rules-field' },
        el('label', { className: 'rot-field-label', textContent: 'Add a word' }),
        el('div', { className: 'chat-add' }, input, addButton),
        why,
      ),
      el('div', { className: 'rules-field' }, el('span', { className: 'rot-field-label', textContent: 'Words' }), search),
      groups,
      el('p', {
        className: 'rot-note',
        textContent:
          'A word is saved in lower case, and matches as a whole word in any case. The bot also catches spellings that only resemble a word (n1gger, k y s) but only tells staff about those. Swearing is allowed and is on no list.',
      }),
    );
  };

  const render = (keep = null) => {
    const focused = document.activeElement?.dataset?.focus ?? keep;
    if (problem && !page) {
      content.replaceChildren(el('div', { className: 'card panel' }, el('p', { textContent: problem })));
      return;
    }
    if (!page) {
      content.replaceChildren(el('div', { className: 'card panel rot-loading' }, el('p', { className: 'muted', textContent: 'Loading the chat filter…' })));
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
      selected = 'racism';
      typed = '';
      query = '';
      problem = null;
      loadedAt = 0;
      render();
    },
    // Each change is sent as it is made, so there is nothing unsaved.
    get dirty() {
      return false;
    },
  };
};
