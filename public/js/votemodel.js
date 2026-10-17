// The next-map vote page's logic, with no DOM so it can be tested: what the bot sends at GET /api/vote, and how the page
// words it.

// "12:05": the time left on the vote, never below 0:00.
export const countdown = (closesAt, now) => {
  const seconds = Math.max(0, Math.ceil((closesAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// A map's share of the votes, as a whole percent. 0 with no votes.
export const share = (votes, total) => (total > 0 ? Math.round((votes / total) * 100) : 0);

// What the page says above the options. `vote` is the bot's vote or null; `closed` is whether its time has run out here.
export const statusText = (vote, now) => {
  if (vote === null) return 'No vote right now. One opens when a match goes live.';
  if (vote.open && now < vote.closesAt) return `Vote for the map after ${vote.fromName}. Closes in ${countdown(vote.closesAt, now)}.`;
  if (vote.winner !== null) {
    return vote.pending
      ? `${vote.winner.name} won. Putting it on the server…`
      : `${vote.winner.name} plays next, infantry only.`;
  }
  return vote.note ?? 'Counting the votes…';
};

// The winner's map id, to highlight it, or null.
export const winnerOf = (vote) => vote?.winner?.map ?? null;

// A random token for this browser, 32 hex characters. Sent with each ballot so a second vote from the same browser
// replaces the first.
export const newToken = (random = (bytes) => crypto.getRandomValues(bytes)) =>
  Array.from(random(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// Why a ballot was not counted, for the person who cast it.
export const refusal = (result) =>
  ({
    closed: 'The vote has closed.',
    none: 'That vote is over. A new one opens with the next match.',
    'unknown-map': 'That map is not in this vote.',
    full: 'The vote is full. Try again with the next match.',
  })[result] ?? 'Your vote was not counted. Try again.';
