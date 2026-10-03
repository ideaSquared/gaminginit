import { busiestChart, dailyChart, hourLabel, populationChart } from './charts.js';
import { BUSY_PLAYERS, busyRuns, busyShares, formatHours, hourlyAverages, isBusy, isOnline, peak, serverState, toLocalHours } from './format.js';
import { startLive } from './live.js';
import { el, setText } from './views.js';

// The stats page: the server's numbers today, players over the last 24 hours, its busy times and the daily peak.

const DAY = 86_400_000;

const $ = (id) => document.getElementById(id);

const hourClock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

let stats = null;

const population = populationChart($('population-chart'));
const daily = dailyChart($('daily-chart'));
const busiestView = busiestChart($('busiest-chart'));

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

startLive((latest) => {
  stats = latest;
  const now = Date.now();
  renderTiles(now);
  renderCharts(now);
});
