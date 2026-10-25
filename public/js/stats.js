import { busiestChart, dailyChart, hourRange, populationChart } from './charts.js';
import { BUSY_PLAYERS, busyRuns, busyShares, clockHour, formatHours, hourlyAverages, isBusy, isOnline, peak, serverState, toLocalHours } from './format.js';
import { watchArt } from './art-stats.js';
import { startLive } from './live.js';
import { el, setText } from './views.js';

// The stats page: the server's numbers today, players over the last 24 hours, its busy times and the daily peak.

const DAY = 86_400_000;

const $ = (id) => document.getElementById(id);

const hourClock = new Intl.DateTimeFormat(undefined, { hour: clockHour(), minute: '2-digit' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

let stats = null;

const population = populationChart($('population-chart'));
const daily = dailyChart($('daily-chart'));
const BUSIEST_PARTS = ['all', 'weekdays', 'weekends'];
const busiestViews = Object.fromEntries(BUSIEST_PARTS.map((key) => [key, busiestChart($(`busiest-${key}-chart`))]));

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
  const today = new Date(now).toISOString().slice(0, 10);
  daily.update({ days: stats?.days ?? [], today, count: 14 });

  // When the server is busy: the hours with the busy threshold or more players at least half the time. Over the last
  // 14 days when the bot sends hourly figures, each hour from its median day so one bad day does not drag it down,
  // and with crashes left out; otherwise over the last 24 hours of readings. The weekdays and the weekends get a chart
  // each when the bot sends them apart, as the server is busy at different times on each.
  const recent = history.filter(([t]) => t >= now - DAY);
  const threshold = stats?.thresholds?.busy ?? BUSY_PLAYERS;
  const hourly = stats?.hourly?.busy ? stats.hourly : null;
  const split = hourly?.weekdays?.busy && hourly?.weekends?.busy;
  const offset = new Date(now).getTimezoneOffset();
  const period = hourly ? `the last ${hourly.days} days` : 'the last 24 hours';
  const figures = hourly
    ? {
        all: [hourly.players, hourly.busy],
        weekdays: [hourly.weekdays?.players, hourly.weekdays?.busy],
        weekends: [hourly.weekends?.players, hourly.weekends?.busy],
      }
    : null;
  $('busiest-all').hidden = Boolean(split);
  $('busiest-weekdays').hidden = !split;
  $('busiest-weekends').hidden = !split;
  setText(
    $('busiest-sub'),
    split
      ? 'Average players in each hour of the day, your local time. Weekdays are Monday to Friday and weekends Saturday and Sunday (UTC days).'
      : 'Average players in each hour of the day, your local time.',
  );
  for (const key of split ? ['weekdays', 'weekends'] : ['all']) {
    const averages = figures ? toLocalHours(figures[key][0], offset) : hourlyAverages(recent);
    const shares = figures ? toLocalHours(figures[key][1], offset) : busyShares(recent, threshold);
    const label = key === 'all' ? period : `${period} on ${key}`;
    busiestViews[key].update({ averages, busy: shares.map(isBusy), period: label });
    tableOf(
      $(`busiest-${key}-table`),
      ['Hour', 'Average players', `Time at ${threshold}+`],
      averages.map((average, hour) => [
        hourRange(hour),
        average === null ? '–' : Math.round(average),
        shares[hour] === null ? '–' : `${Math.round(shares[hour] * 100)}%`,
      ]),
    );
    const runs = busyRuns(shares);
    const range = ({ start, length }) => (length === 24 ? 'All day' : hourRange(start, length));
    $(`busiest-${key}-summary`).hidden = averages.every((a) => a === null);
    $(`busiest-${key}-key`).hidden = runs.length === 0;
    setText($(`busiest-${key}-when`), runs.length === 0 ? 'No busy hours' : runs.map(range).join(', '));
    setText($(`busiest-${key}-players`), runs.length === 0 ? `in ${label}` : `usually ${threshold}+ players`);
  }

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
    [...(stats?.days ?? [])]
      .reverse()
      // Today is not over, so its peak and time live are so far.
      .map((d) => [`${dayLong.format(Date.parse(`${d.day}T00:00:00Z`))}${d.day === today ? ' (so far)' : ''}`, d.peak, formatHours(d.liveMinutes)]),
  );
};

startLive((latest) => {
  stats = latest;
  const now = Date.now();
  renderTiles(now);
  renderCharts(now);
});

watchArt();
