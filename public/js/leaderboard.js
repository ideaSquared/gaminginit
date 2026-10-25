import { BOARDS, boardRows, compact, metres, percent, utcDay } from './format.js';
import { decorateRanks, watchArt, weaponIcon } from './art-stats.js';
import { demoLive } from './demo.js';
import { apiUrl, demo, startLive } from './live.js';
import { boardTable, el, longestHolder, setText, weaponsTable } from './views.js';

// The leaderboard page: the top players over the last 30 days, and the weapons with the most kills.

const DAY = 86_400_000;

const $ = (id) => document.getElementById(id);

const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const ranked = (table, rows, fire) => {
  decorateRanks(table, rows, fire);
  return table;
};

// A weapon-type icon beside each weapon's name.
const withIcons = (table, top) => {
  table.querySelectorAll('tbody tr').forEach((tr, i) => {
    const name = tr.querySelector('.weapon-name');
    if (name && top[i]) name.prepend(weaponIcon(top[i].name, top[i].kind));
  });
  return table;
};

// Players on a kill streak right now: the match highlights come from the live match (/api/live), not from the stats the rest of the page
// reads, so they are asked for separately. The boards are drawn again when who is on fire changes.
let fire = new Set();
let latestStats = null;
const FIRE_MS = 15_000;

const loadFire = async () => {
  let live = null;
  if (demo) live = demoLive(Date.now());
  else if (apiUrl('live') !== '') {
    try {
      const response = await fetch(apiUrl('live'), { headers: { accept: 'application/json' } });
      live = response.ok ? await response.json() : null;
    } catch {
      // No live feed now: nobody is shown on fire, rather than keeping the last answer.
      live = null;
    }
  }
  const next = new Set((live?.match?.highlights?.onFire ?? []).map((f) => f.player?.id).filter(Boolean));
  if (next.size === fire.size && [...next].every((id) => fire.has(id))) return;
  fire = next;
  if (latestStats) renderLeaderboard(latestStats);
};

const renderLeaderboard = (stats) => {
  latestStats = stats;
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
      // Top seeders cover the last week, not the month, when the bot sends them.
      const week = board.key === 'seeding' ? stats.recentSeeders : undefined;
      const rows = boardRows(board, week ? { seeding: week.rows } : leaderboard);
      const sub = board.sub && (week ? `${board.sub(leaderboard)} Over the last ${week.days} days.` : board.sub(leaderboard));
      return el(
        'article',
        { className: 'card board' },
        el('h3', { textContent: board.title }),
        sub ? el('p', { className: 'board-sub', textContent: sub }) : null,
        rows.length > 0 ? ranked(boardTable(board, rows), rows, fire) : el('p', { className: 'muted board-empty', textContent: 'Nobody yet.' }),
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
  root.replaceChildren(withIcons(weaponsTable(weapons.top), weapons.top));
};

startLive((stats) => {
  renderLeaderboard(stats);
  renderWeapons(stats, Date.now());
});

watchArt();
loadFire();
setInterval(() => {
  if (!document.hidden) loadFire();
}, FIRE_MS);
