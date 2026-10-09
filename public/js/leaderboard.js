import { BOARDS, boardRows, compact, metres, percent, utcDay } from './format.js';
import { startLive } from './live.js';
import { boardTable, el, longestHolder, setText, weaponsTable } from './views.js';

// The leaderboard page: the top players over the last 30 days, and the weapons with the most kills.

const DAY = 86_400_000;

const $ = (id) => document.getElementById(id);

const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const renderLeaderboard = (stats) => {
  const root = $('boards');
  const leaderboard = stats?.leaderboard;
  if (!leaderboard) {
    const message = stats ? 'The leaderboard appears once the bot keeps player records.' : 'Waiting for live stats.';
    root.replaceChildren(el('p', { className: 'muted', textContent: message }));
    return;
  }
  setText($('leaderboard-note'), `The last ${leaderboard.days} days on our server (UTC days).`);
  root.replaceChildren(
    ...BOARDS.map((board) => {
      const rows = boardRows(board, leaderboard);
      return el(
        'article',
        { className: 'card board' },
        el('h3', { textContent: board.title }),
        board.sub ? el('p', { className: 'board-sub', textContent: board.sub(leaderboard) }) : null,
        rows.length > 0 ? boardTable(board, rows) : el('p', { className: 'muted board-empty', textContent: 'Nobody yet.' }),
      );
    }),
  );
};

// The top weapons over the last 30 days, from the game's kill feed. Only when the bot has the feed.
const renderWeapons = (stats, now) => {
  const weapons = stats?.weapons ?? null;
  $('weapons').hidden = !weapons;
  if (!weapons) return;
  const first = utcDay(now - (weapons.days - 1) * DAY);
  setText(
    $('weapons-note'),
    `The last ${weapons.days} days on our server (UTC days), from the game’s kill feed.` +
      (weapons.since > first ? ` Recorded since ${dayLong.format(Date.parse(`${weapons.since}T00:00:00Z`))}, when our bot started reading it.` : ''),
  );
  setText($('weapons-kills'), compact(weapons.kills));
  setText($('weapons-headshots'), percent(weapons.kills > 0 ? weapons.headshots / weapons.kills : null));
  setText($('weapons-headshots-sub'), weapons.kills > 0 ? `${compact(weapons.headshots)} of ${compact(weapons.kills)} kills` : '');
  const longest = weapons.longest;
  setText($('weapons-longest'), longest ? metres(longest.distance) : '–');
  $('weapons-longest-sub').replaceChildren(...(longest ? [longestHolder(longest), ` with the ${longest.weapon}`] : []));

  const root = $('weapons-list');
  if (weapons.top.length === 0) {
    root.replaceChildren(el('p', { className: 'muted board-empty', textContent: `No kills recorded in the last ${weapons.days} days.` }));
    return;
  }
  root.replaceChildren(weaponsTable(weapons.top));
};

startLive((stats) => {
  renderLeaderboard(stats);
  renderWeapons(stats, Date.now());
});
