import { dailyChart, populationChart } from './charts.js';
import { demoStats } from './demo.js';
import {
  compact,
  formatDuration,
  formatHours,
  kd,
  peak,
  phaseRanges,
  result,
  scoreLine,
  seedOffer,
  seedRule,
  serverState,
  timeAgo,
} from './format.js';

const REFRESH_MS = 60_000;
const DAY = 86_400_000;

// ?demo shows sample numbers; ?stats=<url> reads another bot, e.g. one running locally with `wrangler dev`.
const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const statsUrl = params.get('stats') ?? document.querySelector('meta[name="stats-url"]')?.content ?? '';
const configured = statsUrl !== '' && !statsUrl.includes('YOUR-SUBDOMAIN');

const $ = (id) => document.getElementById(id);

// Only touches the DOM when the text changes, so screen readers are not told the same thing every 15 seconds.
const setText = (node, value) => {
  if (node.textContent !== value) node.textContent = value;
};

// Builds DOM with textContent only: player and server names come from the game and are never trusted as HTML.
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
};

const hourClock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

let stats = null;
let lastLoad = 0;
let timer = 0;

const population = populationChart($('population-chart'));
const daily = dailyChart($('daily-chart'));

const showNotice = (...content) => {
  const notice = $('notice');
  notice.replaceChildren(...content);
  notice.hidden = content.length === 0;
};

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
  setText($('server-map'), online && server.map ? server.map : '–');
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

// Uses the bot's own thresholds and reward, so the explanation stays right if they change. Until the stats load,
// the page shows the bot's defaults and no reward.
const renderSeeding = () => {
  if (stats?.thresholds) {
    const ranges = phaseRanges(stats.thresholds);
    for (const kind of ['empty', 'seeding', 'live']) setText($(`range-${kind}`), ranges[kind]);
    setText($('seed-live'), String(stats.thresholds.live));
  }
  // Null when the bot's automatic VIP is off.
  const vip = stats?.vip;
  $('seed-reward').hidden = !vip;
  if (!vip) return;
  setText($('seed-offer'), seedOffer(vip));
  setText($('seed-rule'), seedRule(vip));
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

  // Hourly summary of the 24-hour chart, newest first.
  const hours = new Map();
  for (const [at, players] of history.filter(([t]) => t >= now - DAY)) {
    const hour = Math.floor(at / 3_600_000) * 3_600_000;
    const entry = hours.get(hour) ?? { high: 0, low: Infinity };
    hours.set(hour, { high: Math.max(entry.high, players), low: Math.min(entry.low, players) });
  }
  tableOf(
    $('population-table'),
    ['Hour', 'Most players', 'Fewest players'],
    [...hours.entries()].sort((a, b) => b[0] - a[0]).map(([hour, e]) => [hourClock.format(hour), e.high, e.low]),
  );
  tableOf(
    $('daily-table'),
    ['Day (UTC)', 'Peak players', 'Time live'],
    [...(stats?.days ?? [])].reverse().map((d) => [dayLong.format(Date.parse(`${d.day}T00:00:00Z`)), d.peak, formatHours(d.liveMinutes)]),
  );
};

const playersTable = (top) =>
  el(
    'table',
    { className: 'players-table' },
    el(
      'thead',
      {},
      el('tr', {}, ...['#', 'Player', 'Kills', 'Deaths', 'K/D'].map((h) => el('th', { scope: 'col', textContent: h }))),
    ),
    el(
      'tbody',
      {},
      ...top.map((p, i) =>
        el(
          'tr',
          {},
          el('td', { className: 'rank', textContent: String(i + 1) }),
          el('td', { className: 'player', textContent: p.name }),
          el('td', { textContent: String(p.kills) }),
          el('td', { textContent: String(p.deaths) }),
          el('td', { textContent: kd(p.kills, p.deaths) }),
        ),
      ),
    ),
  );

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
      el('span', { className: 'map-tag', textContent: match.map || 'Unknown map' }),
      score ? el('span', { className: 'match-score', textContent: score }) : null,
    ),
    el('p', {
      className: 'match-meta',
      textContent: [
        `Started ${timeAgo(now - match.startedAt)}`,
        match.liveAt ? `live for ${formatDuration(now - match.liveAt)}` : 'not live yet',
        `peak ${match.peakPlayers} players`,
      ].join(' · '),
    }),
    match.top.length > 0 ? playersTable(match.top) : el('p', { className: 'muted', textContent: 'No kills yet.' }),
  );
};

const renderMatches = (now) => {
  const list = $('match-list');
  const matches = stats?.matches ?? [];
  if (matches.length === 0) {
    list.replaceChildren(
      el('li', { className: 'muted', textContent: 'No finished matches yet. They appear here after the server has been live.' }),
    );
    return;
  }
  list.replaceChildren(
    ...matches.map((match) => {
      const outcome = result(match.factionScores);
      const mvp = match.top[0];
      return el(
        'li',
        { className: 'card match' },
        el(
          'p',
          { className: 'match-headline' },
          el('span', { className: 'map-tag', textContent: match.map || 'Unknown map' }),
          el('span', { className: 'match-score', textContent: outcome?.text ?? 'No score recorded' }),
        ),
        el('p', {
          className: 'match-meta',
          textContent: [
            formatDuration(match.durationMs),
            `peak ${match.peakPlayers} players`,
            `ended ${timeAgo(now - match.endedAt)}`,
          ].join(' · '),
        }),
        mvp
          ? el(
              'p',
              { className: 'mvp' },
              el('span', { className: 'mvp-label', textContent: 'Top player' }),
              el('span', { className: 'player', textContent: mvp.name }),
              ` ${mvp.kills} kills, ${kd(mvp.kills, mvp.deaths)} K/D`,
            )
          : null,
        match.top.length > 1
          ? el('details', { className: 'table-view' }, el('summary', { textContent: 'Top 5' }), playersTable(match.top))
          : null,
      );
    }),
  );
};

const render = () => {
  const now = Date.now();
  renderServer(now);
  renderDiscord();
  renderTiles(now);
  renderCharts(now);
  renderCurrentMatch(now);
  renderMatches(now);
  renderSeeding();
};

const link = (href, textContent) => el('a', { href, textContent });

const load = async () => {
  clearTimeout(timer);
  lastLoad = Date.now();
  if (demo) {
    stats = demoStats(Date.now());
    showNotice('Showing sample numbers, not the real server. ', link(location.pathname, 'See live stats'));
    render();
    return;
  }
  if (!configured) {
    showNotice('Live stats are not connected yet. ', link('?demo', 'Preview with sample numbers'));
    render();
    return;
  }

  document.body.classList.add('refreshing');
  try {
    const response = await fetch(statsUrl, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stats = await response.json();
    showNotice();
    render();
  } catch (error) {
    console.error('Could not load stats', error);
    showNotice(
      stats ? 'Could not refresh the live stats. Showing the last numbers we had; trying again in a minute.' : 'Could not load the live stats. Trying again in a minute.',
    );
    if (!stats) render();
  } finally {
    document.body.classList.remove('refreshing');
    if (!document.hidden) timer = setTimeout(load, REFRESH_MS);
  }
};

// Only poll while someone is looking; catch up straight away when they come back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else if (Date.now() - lastLoad >= REFRESH_MS) load();
  else timer = setTimeout(load, REFRESH_MS - (Date.now() - lastLoad));
});

// Keep "updated 2 min ago" honest between fetches.
setInterval(() => {
  if (!document.hidden) renderServer(Date.now());
}, 15_000);

load();
