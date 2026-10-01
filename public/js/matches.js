import { formatDuration, latestMatches } from './format.js';
import { startLive } from './live.js';
import { el, matchHeadline, matchMeta, playersTable } from './views.js';

// The matches page: the latest finished matches, each with its top players.

const MATCHES = 10;

// When the match ended, in the reader's own time: "Wed 1 Oct, 21:40".
const ended = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const render = (stats) => {
  const list = document.getElementById('all-matches');
  const matches = latestMatches(stats?.matches, MATCHES);
  if (matches.length === 0) {
    const message = stats ? 'No finished matches yet. They appear here after the server has been live.' : 'Waiting for live stats.';
    list.replaceChildren(el('li', { className: 'muted', textContent: message }));
    return;
  }
  list.replaceChildren(
    ...matches.map((match) =>
      el(
        'li',
        { className: 'card match' },
        matchHeadline(match),
        matchMeta(`Ended ${ended.format(match.endedAt)}`, formatDuration(match.durationMs), `peak ${match.peakPlayers} players`),
        match.top.length > 0 ? playersTable(match.top) : el('p', { className: 'muted match-empty', textContent: 'No kills recorded.' }),
      ),
    ),
  );
};

startLive(render);
