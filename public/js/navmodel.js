import { isOnline, serverState } from './format.js';
import { peekState } from './votemodel.js';

// What the site header says about the server and the next-map vote, with no DOM so it can be tested. The header shows
// it on every page, so someone reading the leaderboard can see the server needs players, or that a vote is open.

// The server chip: its state, a short label and the players, and the sentence a screen reader hears. null when there is
// nothing worth showing yet (no reading from the bot, or it can't be reached), so the chip stays hidden.
export const serverChip = (stats, now) => {
  const server = stats?.server;
  if (!server) return null;
  const state = serverState(stats, now);
  if (state.kind === 'waiting') return null;
  if (!isOnline(state)) return { kind: state.kind, label: 'Offline', count: '', title: 'The server is not responding' };

  const { players, maxPlayers } = server;
  const live = stats.thresholds?.live ?? 0;
  if (state.kind === 'live') {
    return { kind: 'live', label: 'Live', count: `${players}/${maxPlayers}`, title: `Server live with ${players} of ${maxPlayers} players. See how to join` };
  }
  if (state.kind === 'seeding') {
    const needed = Math.max(0, live - players);
    return {
      kind: 'seeding',
      label: 'Seeding',
      count: `${players}/${live}`,
      title: `Server seeding: ${players} of ${live} players, ${needed} more to go live. See how to join`,
    };
  }
  return { kind: 'empty', label: 'Empty', count: '', title: 'Nobody is on the server. Be the first in. See how to join' };
};

// Whether to flag the vote in the menu: only while it is open, not for the winner shown afterwards.
export const voteOpen = (vote, now) => peekState(vote, now) === 'open';
