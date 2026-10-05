import { populationChart } from './charts.js';
import {
  BOARDS,
  compact,
  formatDuration,
  formatHours,
  isOnline,
  kd,
  latestMatches,
  peak,
  scoreLine,
  serverState,
  timeAgo,
  vipDetail,
  vipOffer,
} from './format.js';
import { keepQuery, startLive } from './live.js';
import { boardTable, el, mapTag, matchHeadline, matchMeta, playerName, playersTable, setText } from './views.js';

// The home page: the server card, a first look at each of the other pages, and how to play with us.

// The home page used to hold these sections. Old links to them, like /#leaderboard, go to their own pages now.
const MOVED = {
  stats: 'stats',
  matches: 'matches',
  leaderboard: 'leaderboard',
  weapons: 'leaderboard#weapons',
  seeding: 'seeding',
};
const redirect = () => {
  const moved = MOVED[location.hash.slice(1)];
  if (moved) location.replace(keepQuery(moved));
  return Boolean(moved);
};
// Also when one is opened while the home page is already open.
addEventListener('hashchange', redirect);
const moved = redirect();

const DAY = 86_400_000;
// The first few of each. Their pages have the rest.
const RECENT_MATCHES = 2;
const TOP_PLAYERS = 3;
const LEADERS = 5;

const $ = (id) => document.getElementById(id);

let stats = null;

const population = populationChart($('population-chart'));

const renderServer = (now) => {
  const state = serverState(stats, now);
  const server = stats?.server ?? null;
  const online = server !== null && isOnline(state);

  const status = $('server-status');
  status.dataset.kind = state.kind;
  setText(status.querySelector('.status-label'), state.label);
  $('server').dataset.kind = state.kind;
  setText($('server-detail'), state.detail);
  $('server-help').hidden = state.kind !== 'seeding' && state.kind !== 'empty';
  setText($('server-name'), server?.name ?? 'Game server');
  setText($('server-updated'), server ? `Updated ${timeAgo(now - server.seenAt)}` : '');
  setText($('players-now'), online ? String(server.players) : '–');
  setText($('players-max'), server ? `/ ${server.maxPlayers} players` : '');
  $('server-map').replaceChildren(online && server.map ? mapTag(server.map) : '–');
  setText($('server-score'), (online && scoreLine(server.factionScores)) || '–');
  setText($('join-server-name'), server?.name ?? 'our server');

  const meter = $('players-meter');
  const max = server?.maxPlayers || 1;
  const players = online ? server.players : 0;
  const live = stats?.thresholds.live ?? 0;
  meter.setAttribute('aria-valuemax', String(max));
  meter.setAttribute('aria-valuenow', String(players));
  const marked = Boolean(server) && live > 0;
  // The "Live at" label is inside the meter, which screen readers read only by its value, so the value says it too.
  meter.setAttribute('aria-valuetext', online ? `${players} of ${max} players${marked ? `, live at ${live}` : ''}` : 'No reading');
  meter.style.setProperty('--fill', String(Math.min(players / max, 1)));
  meter.style.setProperty('--mark', String(Math.min(live / max, 1)));
  meter.classList.toggle('no-mark', !marked);
  setText($('meter-label'), `Live at ${live}`);
};

const renderDiscord = () => {
  const discord = stats?.discord;
  const line = $('discord-count');
  line.hidden = !discord;
  if (!discord) return;
  line.replaceChildren(
    el('strong', { textContent: compact(discord.members) }),
    ' members · ',
    el('span', { className: 'online-dot', ariaHidden: 'true' }),
    el('strong', { textContent: compact(discord.online) }),
    ' online now',
  );
};

// What seeding earns, when the bot gives seeders VIP.
const renderVip = () => {
  const vip = stats?.vip ?? null;
  $('vip-cta').hidden = !vip;
  $('vip').hidden = !vip;
  if (!vip) return;
  setText($('vip-cta-text'), vipOffer(vip));
  setText($('vip-step-offer'), vipOffer(vip));
  setText($('vip-step-detail'), vipDetail(vip));
};

// The match on now: the score and its top players. The live page follows it kill by kill.
const renderCurrentMatch = (now) => {
  const root = $('current-match');
  const state = serverState(stats, now);
  const match = stats?.currentMatch;
  if (!isOnline(state) || !match) {
    const message =
      state.kind === 'offline'
        ? 'The server is not answering right now.'
        : stats
          ? 'No match running. Match stats appear once players are on.'
          : 'Waiting for live stats.';
    root.replaceChildren(el('p', { className: 'muted', textContent: message }));
    return;
  }
  const score = scoreLine(match.factionScores);
  root.replaceChildren(
    el(
      'p',
      { className: 'match-headline' },
      mapTag(match.map),
      score ? el('span', { className: 'match-score', textContent: score }) : null,
    ),
    matchMeta(
      `Started ${timeAgo(now - match.startedAt)}`,
      match.liveAt ? `live for ${formatDuration(now - match.liveAt)}` : 'not live yet',
      `peak ${match.peakPlayers} players`,
    ),
    match.top.length > 0 ? playersTable(match.top.slice(0, TOP_PLAYERS)) : el('p', { className: 'muted', textContent: 'No kills yet.' }),
  );
};

// The latest matches, one short row each.
const renderMatches = (now) => {
  const list = $('match-list');
  const matches = latestMatches(stats?.matches, RECENT_MATCHES);
  if (matches.length === 0) {
    const message = stats ? 'No finished matches yet. They appear here after the server has been live.' : 'Waiting for live stats.';
    list.replaceChildren(el('li', { className: 'muted', textContent: message }));
    return;
  }
  list.replaceChildren(
    ...matches.map((match) => {
      const mvp = match.top[0];
      return el(
        'li',
        { className: 'match-row' },
        matchHeadline(match),
        matchMeta(formatDuration(match.durationMs), `peak ${match.peakPlayers} players`, `ended ${timeAgo(now - match.endedAt)}`),
        mvp
          ? el(
              'p',
              { className: 'mvp' },
              el('span', { className: 'mvp-label', textContent: 'Top player' }),
              el('span', { className: 'player' }, playerName(mvp)),
              ` ${mvp.kills} kills, ${kd(mvp.kills, mvp.deaths)} K/D`,
            )
          : null,
      );
    }),
  );
};

// The top of the leaderboard's first board, most kills.
const renderBoard = () => {
  const root = $('peek-board');
  const leaderboard = stats?.leaderboard;
  if (!leaderboard) {
    const message = stats ? 'The leaderboard appears once the bot keeps player records.' : 'Waiting for live stats.';
    root.replaceChildren(el('p', { className: 'muted', textContent: message }));
    return;
  }
  const [board] = BOARDS;
  setText($('board-title'), `${board.title}, last ${leaderboard.days} days`);
  const rows = (leaderboard[board.key] ?? []).slice(0, LEADERS);
  root.replaceChildren(rows.length > 0 ? boardTable(board, rows) : el('p', { className: 'muted', textContent: 'Nobody yet.' }));
};

// Players over the last 24 hours, with the day's headline numbers above.
const renderPopulation = (now) => {
  population.update({
    history: stats?.history ?? [],
    capacity: stats?.server?.maxPlayers ?? 0,
    live: stats?.thresholds.live ?? 20,
    now,
  });
  const history = (stats?.history ?? []).filter(([at]) => at >= now - DAY);
  const matches = (stats?.matches ?? []).filter((m) => now - m.endedAt < DAY).length;
  const today = stats?.days.find((d) => d.day === new Date(now).toISOString().slice(0, 10));
  setText(
    $('peek-stats'),
    stats
      ? [
          history.length > 0 ? `Peak ${peak(history)} players` : null,
          `${matches} match${matches === 1 ? '' : 'es'}`,
          `live ${formatHours(today?.liveMinutes ?? 0)} today`,
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
  );
};

if (!moved) {
  startLive((latest) => {
    stats = latest;
    const now = Date.now();
    renderServer(now);
    renderDiscord();
    renderVip();
    renderCurrentMatch(now);
    renderMatches(now);
    renderBoard();
    renderPopulation(now);
  });

  // Keep "updated 2 min ago" honest between fetches.
  setInterval(() => {
    if (!document.hidden) renderServer(Date.now());
  }, 15_000);
}
