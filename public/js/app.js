import { busiestChart, dailyChart, hourLabel, populationChart } from './charts.js';
import {
  BOARDS,
  BUSY_PLAYERS,
  busyRuns,
  busyShares,
  compact,
  emptyNote,
  formatDuration,
  formatHours,
  hourlyAverages,
  isBusy,
  kd,
  latestMatches,
  peak,
  phaseRanges,
  scoreLine,
  serverState,
  timeAgo,
  toLocalHours,
  vipDetail,
  vipOffer,
} from './format.js';
import { startLive } from './live.js';
import { el, mapTag, matchHeadline, matchMeta, playersTable, setText } from './views.js';

const DAY = 86_400_000;
// The rest are on the matches page.
const RECENT_MATCHES = 3;

const $ = (id) => document.getElementById(id);

const hourClock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

let stats = null;

const population = populationChart($('population-chart'));
const daily = dailyChart($('daily-chart'));
const busiestView = busiestChart($('busiest-chart'));

const isOnline = (state) => state.kind === 'live' || state.kind === 'seeding' || state.kind === 'empty';

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
  meter.setAttribute('aria-valuemax', String(max));
  meter.setAttribute('aria-valuenow', String(players));
  meter.setAttribute('aria-valuetext', online ? `${players} of ${max} players` : 'No reading');
  meter.style.setProperty('--fill', String(Math.min(players / max, 1)));
  meter.style.setProperty('--mark', String(Math.min((stats?.thresholds.live ?? 0) / max, 1)));
  meter.classList.toggle('no-mark', !server);
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

const renderTiles = (now) => {
  const state = serverState(stats, now);
  const server = stats?.server;
  const today = new Date(now).toISOString().slice(0, 10);
  const todayStats = stats?.days.find((d) => d.day === today);
  const history = (stats?.history ?? []).filter(([at]) => at >= now - DAY);
  const matches = (stats?.matches ?? []).filter((m) => now - m.endedAt < DAY);

  $('tile-now').textContent = server && isOnline(state) ? String(server.players) : '–';
  $('tile-peak').textContent = history.length > 0 ? String(peak(history)) : '–';
  $('tile-live').textContent = stats ? formatHours(todayStats?.liveMinutes ?? 0) : '–';
  $('tile-matches').textContent = stats ? String(matches.length) : '–';
};

const tableOf = (table, headings, rows) => {
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...headings.map((h) => el('th', { scope: 'col', textContent: h })))),
    el('tbody', {}, ...rows.map((row) => el('tr', {}, ...row.map((cell) => el('td', { textContent: String(cell) }))))),
  );
};

const renderCharts = (now) => {
  const history = stats?.history ?? [];
  population.update({
    history,
    capacity: stats?.server?.maxPlayers ?? 0,
    live: stats?.thresholds.live ?? 20,
    now,
  });
  daily.update({ days: stats?.days ?? [], today: new Date(now).toISOString().slice(0, 10), count: 14 });

  // When the server is busy: the hours with the busy threshold or more players at least half the time. Over the last
  // 14 days when the bot sends hourly figures, otherwise over the last 24 hours of readings.
  const recent = history.filter(([t]) => t >= now - DAY);
  const threshold = stats?.thresholds?.busy ?? BUSY_PLAYERS;
  const hourly = stats?.hourly?.busy ? stats.hourly : null;
  const period = hourly ? `the last ${hourly.days} days` : 'the last 24 hours';
  const offset = new Date(now).getTimezoneOffset();
  const averages = hourly ? toLocalHours(hourly.players, offset) : hourlyAverages(recent);
  const shares = hourly ? toLocalHours(hourly.busy, offset) : busyShares(recent, threshold);
  busiestView.update({ averages, busy: shares.map(isBusy), period });
  setText(
    $('busiest-sub'),
    `Average players in each hour of the day over ${period}, your local time. ` +
      `Busy hours have ${threshold}+ players at least half the time.`,
  );
  tableOf(
    $('busiest-table'),
    ['Hour', 'Average players', `Time at ${threshold}+`],
    averages.map((average, hour) => [
      `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`,
      average === null ? '–' : Math.round(average),
      shares[hour] === null ? '–' : `${Math.round(shares[hour] * 100)}%`,
    ]),
  );
  const runs = busyRuns(shares);
  const range = ({ start, length }) => (length === 24 ? 'All day' : `${hourLabel(start)}–${hourLabel((start + length) % 24)}`);
  $('busiest-summary').hidden = averages.every((a) => a === null);
  $('busiest-key').hidden = runs.length === 0;
  setText($('busiest-when'), runs.length === 0 ? 'No busy hours' : runs.map(range).join(', '));
  setText($('busiest-players'), runs.length === 0 ? `in ${period}` : `usually ${threshold}+ players`);

  // Hourly summary of the 24-hour chart, newest first.
  const hours = new Map();
  for (const [at, players] of recent) {
    const hour = Math.floor(at / 3_600_000) * 3_600_000;
    const entry = hours.get(hour) ?? { high: 0, low: Infinity, total: 0, count: 0 };
    hours.set(hour, {
      high: Math.max(entry.high, players),
      low: Math.min(entry.low, players),
      total: entry.total + players,
      count: entry.count + 1,
    });
  }
  tableOf(
    $('population-table'),
    ['Hour', 'Average', 'Most players', 'Fewest players'],
    [...hours.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([hour, e]) => [hourClock.format(hour), Math.round(e.total / e.count), e.high, e.low]),
  );
  tableOf(
    $('daily-table'),
    ['Day (UTC)', 'Peak players', 'Time live'],
    [...(stats?.days ?? [])].reverse().map((d) => [dayLong.format(Date.parse(`${d.day}T00:00:00Z`)), d.peak, formatHours(d.liveMinutes)]),
  );
};

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
    match.top.length > 0 ? playersTable(match.top) : el('p', { className: 'muted', textContent: 'No kills yet.' }),
  );
};

// The latest few matches, one short row each. The matches page has the rest, with each match's top players.
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
              el('span', { className: 'player', textContent: mvp.name }),
              ` ${mvp.kills} kills, ${kd(mvp.kills, mvp.deaths)} K/D`,
            )
          : null,
      );
    }),
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

// Uses the bot's own thresholds, so the explanation stays right if they change. Until the stats load, the page shows
// the bot's defaults.
const renderSeeding = () => {
  $('seed-vip').hidden = !stats?.vip;
  if (!stats?.thresholds) return;
  const ranges = phaseRanges(stats.thresholds);
  for (const kind of ['empty', 'seeding', 'live']) setText($(`range-${kind}`), ranges[kind]);
  setText($('note-empty'), emptyNote(stats.thresholds));
  setText($('seed-live'), String(stats.thresholds.live));
};

const boardTable = (board, rows) =>
  el(
    'table',
    { className: 'players-table' },
    el(
      'thead',
      {},
      el('tr', {}, ...['#', 'Player', ...board.headings].map((h) => el('th', { scope: 'col', textContent: h }))),
    ),
    el(
      'tbody',
      {},
      ...rows.map((p, i) =>
        el(
          'tr',
          {},
          el('td', { className: 'rank', textContent: String(i + 1) }),
          el('td', { className: 'player', textContent: p.name }),
          ...board.cells(p).map((cell) => el('td', { textContent: cell })),
        ),
      ),
    ),
  );

const renderLeaderboard = () => {
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
      const rows = leaderboard[board.key] ?? [];
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

const render = (latest) => {
  stats = latest;
  const now = Date.now();
  renderServer(now);
  renderDiscord();
  renderVip();
  renderTiles(now);
  renderCharts(now);
  renderCurrentMatch(now);
  renderMatches(now);
  renderLeaderboard();
  renderSeeding();
};

startLive(render);

// Keep "updated 2 min ago" honest between fetches.
setInterval(() => {
  if (!document.hidden) renderServer(Date.now());
}, 15_000);
