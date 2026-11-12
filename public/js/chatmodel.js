// The Chat filter tab's logic, apart from the page: what a word looks like once the bot has tidied it, what is wrong with
// a word before it is sent, and the words of a list as the page shows them. The bot checks a word the same way when it
// is added. `page` is the bot's GET /api/admin/chatwords: for each list its starter words (`defaults`), the words staff
// added (`added`) and the starter words they took out (`removed`).

const trimPunctuation = (word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

// Lower case, the punctuation around each word taken off, the words one space apart.
export const tidyWord = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/\s+/)
    .map(trimPunctuation)
    .filter((word) => word !== '')
    .join(' ');

const squash = (text) => text.replace(/[^\p{L}\p{N}]/gu, '');

// The words that are on a list now: its starter words, less those taken out, and those added.
export const listedWords = (list) => {
  const out = new Set(list.removed);
  return [...new Set([...list.defaults.filter((word) => !out.has(word)), ...list.added])];
};

// What is wrong with a word to add, or null when nothing is. `list` is the list it is going on.
export const wordProblem = (text, list, page) => {
  const word = tidyWord(text);
  if (squash(word).length < 3) return 'A word needs at least 3 letters or numbers.';
  if (word.length > page.maxWord) return `A word can be at most ${page.maxWord} characters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}' -]*$/u.test(word)) return 'Use letters, numbers, spaces, apostrophes and hyphens only.';
  const count = word.split(' ').length;
  if (list.id === 'allow' && count > 1) return 'An allowed word is one word, with no spaces.';
  if (count > page.maxPhraseWords) return `A phrase can be at most ${page.maxPhraseWords} words.`;
  if (listedWords(list).includes(word)) return `"${word}" is on the list already.`;
  if (list.added.length >= page.maxAdded && !list.defaults.includes(word)) return `A list can have at most ${page.maxAdded} added words.`;
  return null;
};

// The words to show, in groups: those staff added, then the starter words (with those taken out marked, so they can be
// put back). `query` keeps the words that contain it.
export const wordGroups = (list, query = '') => {
  const wanted = tidyWord(query);
  const keep = (word) => wanted === '' || word.includes(wanted);
  const out = new Set(list.removed);
  const added = list.added.filter(keep).map((word) => ({ word, kind: 'added' }));
  const starter = list.defaults.filter(keep).map((word) => ({ word, kind: out.has(word) ? 'removed' : 'default' }));
  return [
    { title: 'Added by staff', words: added },
    { title: 'Starter words', words: starter },
  ];
};

// What the button on a word does, and what it says.
export const wordButton = (row) =>
  row.kind === 'removed' ? { action: 'restore', text: 'Put back', label: `Put ${row.word} back` } : { action: 'remove', text: '×', label: `Take ${row.word} out` };

// "62 words", or "62 words: 2 added, 1 starter word taken out".
export const countText = (list) => {
  const total = listedWords(list).length;
  const parts = [
    ...(list.added.length > 0 ? [`${list.added.length} added`] : []),
    ...(list.removed.length > 0 ? [`${list.removed.length} starter ${list.removed.length === 1 ? 'word' : 'words'} taken out`] : []),
  ];
  return `${total} ${total === 1 ? 'word' : 'words'}${parts.length > 0 ? `: ${parts.join(', ')}` : ''}`;
};

// What the bot is set to do, for the top of the tab: null when it does everything.
export const switchNote = (page) => {
  if (!page.enabled) return 'The bot is not reading the chat: CHAT_MOD is off, so none of this does anything until it is turned on.';
  if (!page.actions) {
    return 'Automatic actions are off (CHAT_MOD_ACTIONS), so the bot only posts matches to the moderation log. It does not ban or warn.';
  }
  return null;
};

// Whether a draft in the add box is worth sending, for the Add button.
export const canAdd = (text) => tidyWord(text) !== '';
