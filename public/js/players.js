import { daysAgo, formatHours, searchPlayers, utcDay } from './format.js';
import { demoPlayers } from './demo.js';
import { apiUrl, startLive } from './live.js';
import { el, playerName } from './views.js';

// The players page: who is in game now, and everyone seen lately, to find a player's page.

// The list shows this many at first, and this many more each time "Show more" is pressed.
const LISTED = 50;

const $ = (id) => document.getElementById(id);

let directory = null;
let listed = LISTED;

const renderOnline = () => {
  const online = (directory?.players ?? []).filter((p) => p.online);
  $('online-panel').hidden = online.length === 0;
  $('online-list').replaceChildren(
    ...[...online].sort((a, b) => a.name.localeCompare(b.name)).map((p) => el('li', {}, playerName(p))),
  );
};

const renderList = () => {
  const table = $('player-list');
  if (!directory) {
    table.replaceChildren();
    $('player-count').textContent = 'Waiting for live stats.';
    $('more-players').hidden = true;
    return;
  }
  const query = $('player-search').value;
  const found = searchPlayers(directory.players, query);
  const today = utcDay(Date.now());
  $('player-count').textContent =
    directory.players.length === 0
      ? 'Nobody yet. Players appear here once they have been on the server.'
      : query.trim() === ''
        ? `${found.length} players, most time played first.`
        : found.length === 0
          ? `Nobody matches “${query.trim()}”. Players are listed for ${directory.days} days after they last played.`
          : `${found.length} ${found.length === 1 ? 'player matches' : 'players match'} “${query.trim()}”.`;
  if (found.length === 0) {
    table.replaceChildren();
    $('more-players').hidden = true;
    return;
  }
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...['Player', 'Time played', 'Last played'].map((h) => el('th', { scope: 'col', textContent: h })))),
    el(
      'tbody',
      {},
      ...found.slice(0, listed).map((p) =>
        el(
          'tr',
          {},
          el('td', { className: 'player' }, playerName(p), p.online ? el('span', { className: 'online-dot online-after', title: 'In game now' }) : null),
          el('td', { textContent: formatHours(p.minutes) }),
          el('td', { textContent: p.online ? 'In game now' : daysAgo(p.lastSeen, today) }),
        ),
      ),
    ),
  );
  $('more-players').hidden = listed >= found.length;
  $('more-players').textContent = `Show more (${found.length - listed} left)`;
};

const render = (latest) => {
  directory = latest;
  if (directory) $('players-note').textContent = `Everyone who has played on our server in the last ${directory.days} days. Pick a name to see their stats.`;
  renderOnline();
  renderList();
};

$('player-search').addEventListener('input', () => {
  listed = LISTED;
  renderList();
});

$('more-players').addEventListener('click', () => {
  listed += LISTED;
  renderList();
});

startLive(render, { url: apiUrl('players'), sample: demoPlayers });
