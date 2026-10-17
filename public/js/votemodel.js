// The next-map vote page's logic, with no DOM so it can be tested: what the bot sends at GET /api/vote, and how the page
// words it. Votes are cast in Discord, or on the page by a signed-in member (see vote.js).

// "12:05": the time left on the vote, never below 0:00.
export const countdown = (closesAt, now) => {
  const seconds = Math.max(0, Math.ceil((closesAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// A map's share of the votes, as a whole percent. 0 with no votes.
export const share = (votes, total) => (total > 0 ? Math.round((votes / total) * 100) : 0);

// What the page says above the options. `vote` is the bot's vote or null; `closed` is whether its time has run out here.
export const statusText = (vote, now) => {
  if (vote === null) return 'No vote right now. One opens in Discord when a match goes live.';
  if (vote.open && now < vote.closesAt) {
    // The score is what normally closes it; the time is only a backstop, so it is only named when there is no score.
    const closing = vote.closeScore > 0 ? `when a team reaches ${vote.closeScore} points` : `in ${countdown(vote.closesAt, now)}`;
    return `Vote for the map after ${vote.fromName}, here or in Discord. Closes ${closing}.`;
  }
  if (vote.winner !== null) {
    return vote.pending
      ? `${vote.winner.name} won. Putting it on the server…`
      : `${vote.winner.name} plays next, infantry only${vote.lightingName ? `, ${vote.lightingName}` : ''}${vote.zoneName ? `, ${vote.zoneName} zones` : ''}.`;
  }
  return vote.note ?? 'Counting the votes…';
};

// The winner's map id, to highlight it, or null.
export const winnerOf = (vote) => vote?.winner?.map ?? null;

// How long the landing page keeps showing a vote's result: the match is over a few minutes after the vote closes, and the
// map it chose is then the one being played.
export const RESULT_SHOWN_MS = 15 * 60_000;

// What the landing page shows of the vote: 'open', 'won' (a winner, shortly after it closed) or 'none'.
export const peekState = (vote, now) => {
  if (vote === null || vote === undefined) return 'none';
  if (vote.open && now < vote.closesAt) return 'open';
  if (vote.winner !== null && vote.closedAt !== null && now - vote.closedAt < RESULT_SHOWN_MS) return 'won';
  return 'none';
};

// The landing card's heading.
export const peekTitle = (vote, state) => (state === 'won' ? `Next map: ${vote.winner.name}` : 'Vote for the next map');
