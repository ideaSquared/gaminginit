// The Live chat view's logic, apart from the page: merging the lines the bot sends, how a verdict and an action read, and
// which lines the filters keep. A line is the bot's GET /api/admin/chat line: { id, steamId, name, shownAs?, text,
// rawText?, channel?, faction?, ping?, at, verdict? }, where verdict is { kind: 'clean' | 'exact' | 'fuzzy', list?, word?,
// others?, action }.

// The most lines the page keeps.
export const MAX_LINES = 500;

// Lines with those already had: one for each id, oldest first, the latest MAX_LINES kept.
export const mergeLines = (have, incoming, max = MAX_LINES) => {
  const byId = new Map(have.map((line) => [line.id, line]));
  // A line the bot sends again (its verdict changed, as when an action failed) replaces the one had.
  for (const line of incoming) byId.set(line.id, line);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-max);
};

export const newestId = (lines) => lines.reduce((top, line) => Math.max(top, line.id), 0);

const CLEAN = { kind: 'clean', action: 'none' };

export const verdictOf = (line) => line.verdict ?? CLEAN;

export const isFlagged = (line) => verdictOf(line).kind !== 'clean';

const LISTS = { racism: 'racism list', toxicity: 'toxicity list' };

// How a verdict reads, and its tone for the page: the badge is words as well as colour.
export const verdictText = (line) => {
  const v = verdictOf(line);
  if (v.kind === 'exact') return { tone: 'exact', badge: 'Exact', text: `Exact match, ${LISTS[v.list] ?? 'a list'}: ${v.word}` };
  if (v.kind === 'fuzzy') return { tone: 'fuzzy', badge: 'Resembles', text: `Resembles ${v.word} on the ${LISTS[v.list] ?? 'a list'}` };
  return { tone: 'clean', badge: '', text: '' };
};

const ACTIONS = {
  banned: 'Banned',
  warned: 'Warned in game',
  alert: 'Alert only',
  staff: 'Staff: no action',
  'actions-off': 'Alert only: automatic actions are off',
  'no-player': 'No player behind it: no action',
  folded: 'Acted on for another line in the same minute',
  backlog: 'Said before the bot started: no action',
  failed: 'The action failed',
  none: '',
};

// What the bot did about a flagged line, or '' for a clean one.
export const actionText = (line) => (isFlagged(line) ? (ACTIONS[verdictOf(line).action] ?? '') : '');

// The name staff see, and the one other players saw when it differs.
export const nameText = (line) => `${line.name || 'Unknown'}${line.shownAs ? ` (shown as ${line.shownAs})` : ''}`;

// Where it was said: "Team · Lonestar".
export const placeText = (line) => [line.channel, line.faction].filter(Boolean).join(' · ');

// The lines the filters keep: only flagged ones, and those of one player (a Steam ID, or part of a name).
export const filterLines = (lines, { flaggedOnly = false, player = '' } = {}) => {
  const wanted = player.trim().toLowerCase();
  return lines.filter(
    (line) =>
      (!flaggedOnly || isFlagged(line)) &&
      (wanted === '' || line.steamId === wanted || line.name.toLowerCase().includes(wanted) || (line.shownAs ?? '').toLowerCase().includes(wanted)),
  );
};

// Whether a scrolling box is at its end, give or take a few pixels: then new lines keep it there.
export const nearBottom = ({ scrollTop, scrollHeight, clientHeight }, slack = 24) => scrollHeight - scrollTop - clientHeight <= slack;

// "3 new lines", for the jump button.
export const newText = (count) => (count <= 0 ? 'Jump to latest' : `${count} new ${count === 1 ? 'line' : 'lines'}: jump to latest`);

// What to say above the lines when the bot is not giving any: null when it is.
export const feedNote = (feed) => {
  if (!feed.enabled) return 'The bot is not reading the chat: CHAT_MOD is off.';
  if (!feed.available) return 'The game server does not serve the chat (GET /v1/chat), so there is nothing to show.';
  return null;
};

// What the bot privately told a player whose line it answered, for staff: a cheating claim, or a call for an admin.
const REPLIES = {
  cheat: 'Bot replied: report it in our Discord with a clip or screenshot, or from the scoreboard without',
  admin: 'Bot replied: raise a ticket in our Discord',
};
// Only the table's own keys: an id such as "toString" is not a reply.
export const replyText = (line) => (typeof line.reply === 'string' && Object.hasOwn(REPLIES, line.reply) ? REPLIES[line.reply] : '');
