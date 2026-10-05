import { formatDuration, hourStyle, latestMatches } from './format.js';
import { startLive } from './live.js';
import { el, matchHeadline, matchMeta, playersTable } from './views.js';

// The matches page: the latest finished matches, each with its top players. Each card has the id `match-<endedAt>`
// (the match's endedAt in ms, as the bot sends it), so /matches#match-<endedAt> links to one match; the bot's
// "Match over" posts in Discord use it.

const MATCHES = 10;

// When the match ended, in the reader's own time: "Wed 1 Oct, 21:40".
const ended = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: hourStyle(), minute: '2-digit' });

// The match the address links to, as its card id, or null when the address does not link to a match.
const linked = () => {
  try {
    const id = decodeURIComponent(location.hash.slice(1));
    return /^match-\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

// Whether the bot's numbers are in. Until then, a match the address links to could still be on its way.
let loaded = false;

// Outlines the card the address links to, and says so when that match has dropped off the list.
const markLinked = () => {
  const id = linked();
  const cards = [...document.querySelectorAll('#all-matches .match')];
  for (const card of cards) card.classList.toggle('match-linked', card.id === id);
  document.getElementById('match-missing').hidden = !(loaded && id !== null && !cards.some((card) => card.id === id));
};

const render = (stats) => {
  const list = document.getElementById('all-matches');
  const matches = latestMatches(stats?.matches, MATCHES);
  loaded = stats !== null;
  if (matches.length === 0) {
    const message = stats ? 'No finished matches yet. They appear here after the server has been live.' : 'Waiting for live stats.';
    list.replaceChildren(el('li', { className: 'muted', textContent: message }));
    markLinked();
    return;
  }
  list.replaceChildren(
    ...matches.map((match) =>
      el(
        'li',
        { className: 'card match', id: `match-${match.endedAt}` },
        matchHeadline(match),
        matchMeta(`Ended ${ended.format(match.endedAt)}`, formatDuration(match.durationMs), `peak ${match.peakPlayers} players`),
        match.top.length > 0 ? playersTable(match.top) : el('p', { className: 'muted match-empty', textContent: 'No kills recorded.' }),
      ),
    ),
  );
  markLinked();
};

// A link to another match on this page, or a changed address, moves the outline.
addEventListener('hashchange', markLinked);

startLive(render);
