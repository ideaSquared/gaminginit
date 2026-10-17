// The next-map vote page's logic, with no DOM so it can be tested: what the bot sends at GET /api/vote, and how the page
// words it. Votes are cast in Discord; the page only shows them.

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
  if (vote.open && now < vote.closesAt) return `Voting in Discord for the map after ${vote.fromName}. Closes in ${countdown(vote.closesAt, now)}.`;
  if (vote.winner !== null) {
    return vote.pending
      ? `${vote.winner.name} won. Putting it on the server…`
      : `${vote.winner.name} plays next, infantry only.`;
  }
  return vote.note ?? 'Counting the votes…';
};

// The winner's map id, to highlight it, or null.
export const winnerOf = (vote) => vote?.winner?.map ?? null;
