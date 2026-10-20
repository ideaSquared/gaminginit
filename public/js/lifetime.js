import {
  barLengths,
  croppedLine,
  dailyPoints,
  formatHours,
  hottest,
  LEAVE_TIMINGS,
  LIFETIME_TABLES,
  lifetimeLeaves,
  lifetimeText,
  lifetimeTiles,
  peopleSlots,
  returnShare,
  rowShare,
  shareOf,
  THIN_LEAST,
} from './format.js';
import { barList, card, drawHeatmap } from './playtime.js';
import { cell, number, setStatus, table } from './staff.js';
import { lineChart, peopleChart, rolling } from './trends.js';
import { el } from './views.js';

// The staff page's Lifetime view (Server, see server.js): what the bot has kept for good about the server since it began
// (the bot's README, "Lifetime records"). Headline figures, then players by day and week, how many new players came
// back, a line for each figure that changes over time, where players leave and which maps lose them, and when. Every
// chart has its numbers under "Show as table", and each table the bot keeps can be downloaded as CSV for a spreadsheet
// or a notebook. The daily lines follow the range buttons (All time, 90 days, 30 days).

const RANGES = { all: null, 90: 90, 30: 30 };
const MONTHS_SHORT = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const at = (day) => Date.parse(`${day}T00:00:00Z`);
const whole = (v) => String(Math.round(v));

// How a daily figure reads on the axis (`axis`) and in the tooltip.
const FORMATS = {
  count: (v) => whole(v),
  hours: (v, axis) => (axis ? `${Math.round(v)} h` : `${v < 10 ? v.toFixed(1) : Math.round(v)} h`),
  minutes: (v, axis) => (axis ? `${Math.round(v)}m` : formatHours(v)),
  percent: (v) => `${Math.round(v)}%`,
};

// The daily figures that get a line: what it is, how to read a row, and how it is written.
const LINES = [
  { key: 'hours', title: 'Player hours each day', note: 'Hours everyone spent on the server in the day.', pick: (r) => (r.player_minutes === null ? null : r.player_minutes / 60), format: 'hours' },
  { key: 'peak', title: 'Peak players each day', note: 'The most players in the day’s busiest match.', pick: (r) => r.peak_players, format: 'count' },
  { key: 'stay', title: 'Typical stay', note: 'The median stay of those who left that day. Days before the bot kept stays have none.', pick: (r) => r.median_stay_minutes, format: 'minutes' },
  { key: 'bounce', title: 'New players who left within 10 minutes', note: 'Share of new players’ stays under 10 minutes.', pick: (r) => rowShare(r, 'short_stays_new', 'stays_new'), format: 'percent' },
  { key: 'fill', title: 'Minutes to fill the server', note: 'How long matches that started with the server seeding took to go live, on average.', pick: (r) => (r.seeded_matches ? r.seeding_minutes / r.seeded_matches : null), format: 'minutes' },
  { key: 'seeders', title: 'Seeders still there at go-live', note: 'Share of those in game while a match seeded who were still there when it went live.', pick: (r) => rowShare(r, 'seeders_at_go_live', 'seeders'), format: 'percent' },
];

const legend = (...items) =>
  el('ul', { className: 'pt-legend' }, ...items.map(([className, name]) => el('li', {}, el('span', { className: `pt-key ${className}`, ariaHidden: 'true' }), name)));

export const createLifetime = (root, { download }) => {
  const tiles = el('div', { className: 'tiles pt-tiles' });
  const dayPeople = card('pt-wide', 'Players each day', 'Players on the server each day, the latest 90 days. The part picked out is those playing for the first time.');
  const weekPeople = card('pt-wide', 'Players each week', 'Different players each week, since the bot began. The part picked out is those playing for the first time.');
  const months = card('pt-wide', 'By month', 'Regulars play 5 or more days in a month. Stickiness is the average day’s players as a share of the month’s: how often those who play come on.');
  const cohorts = card('pt-wide', 'Do new players come back?', 'By the week a player was first seen: how many came back within 1, 7, 30 and 90 days, out of those whose days are over.');
  const lines = LINES.map((spec) => ({ spec, ...card('', spec.title, spec.note) }));
  const leaves = card('', 'Where in a match players leave', '');
  const maps = card('', 'By map', 'Share of players in game when a match went live who left before its last 3 minutes, over every match kept. The map that loses most is picked out.');
  const heat = card('pt-wide', 'Leaves by hour', 'Leaves per 100 hours of play by hour of the week in UTC, over every day kept. Blank hours have under 10 hours of play. Hover or Tab to a cell to read it.');
  const heatNote = el('p', { className: 'section-note pt-peak', ariaLive: 'polite' });
  heat.grid.className = 'admin-table heatmap';
  heat.node.insertBefore(heatNote, heat.chart);
  heat.node.querySelector('.pt-details').replaceWith(el('div', { className: 'admin-scroll' }, heat.grid));

  // The charts need a container of their own to measure.
  for (const c of [dayPeople, weekPeople, ...lines]) c.chart.className = 'chart pt-chart';
  const dayChart = peopleChart(dayPeople.chart);
  const weekChart = peopleChart(weekPeople.chart);
  for (const l of lines) l.line = lineChart(l.chart);
  for (const c of [dayPeople, weekPeople]) c.node.insertBefore(legend(['pt-key-returning', 'Returning players'], ['pt-key-new', 'New players']), c.chart.nextSibling);
  for (const l of lines) l.node.insertBefore(legend(['pt-key-raw', 'Each day'], ['pt-key-avg', '7-day average']), l.chart.nextSibling);

  const exportStatus = el('p', { className: 'section-note', ariaLive: 'polite' });
  const exportButtons = LIFETIME_TABLES.map(([key, label, what]) => {
    const button = el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: label, title: what });
    button.addEventListener('click', async () => {
      button.disabled = true;
      setStatus(exportStatus, `Getting ${label.toLowerCase()}…`);
      try {
        const done = await download(key);
        setStatus(exportStatus, done ? `Downloaded ${label.toLowerCase()} (${what}).` : 'Couldn’t get that just now. Try again in a minute.');
      } catch (error) {
        console.error('Could not download the lifetime table', error);
        setStatus(exportStatus, 'Couldn’t reach the bot. Try again in a minute.');
      } finally {
        button.disabled = false;
      }
    });
    return button;
  });
  const exports = el(
    'section',
    { className: 'card pt-card pt-wide' },
    el('h3', { className: 'pt-title', textContent: 'Download the data' }),
    el('p', { className: 'section-note pt-note', textContent: 'Each table as CSV, for a spreadsheet or a notebook. No Steam IDs, so it is safe to share with the team. Columns are described in the bot’s README, “Lifetime records”.' }),
    el('div', { className: 'pt-downloads' }, ...exportButtons),
    exportStatus,
  );

  const cards = [dayPeople, weekPeople, months, cohorts, ...lines, leaves, maps, heat];
  root.replaceChildren(tiles, el('div', { className: 'pt-grid' }, ...cards.map((c) => c.node), exports));

  // A plain table of a daily line's numbers.
  const valueTable = (grid, points, format, name) =>
    table(
      grid,
      ['Day', [name, 'num']],
      [...points].reverse().map((p) => el('tr', {}, cell(p.day), number(p.value === null ? '–' : format(p.value)))),
      'Nothing yet.',
    );

  const renderPeople = (l) => {
    const days = peopleSlots(l.daily, { key: 'day', total: 'unique_players', fresh: 'new_players', label: (r) => DAY_SHORT.format(at(r.day)), title: (r) => r.day }, 90);
    dayChart.update({ slots: days, unit: 'day' });
    table(
      dayPeople.grid,
      ['Day', ['Players', 'num'], ['New', 'num'], ['Returning', 'num'], ['Hours', 'num']],
      [...l.daily.slice(-90)].reverse().map((r) => el('tr', {}, cell(r.day), number(r.unique_players), number(r.new_players ?? '–'), number(r.returning_players ?? '–'), number(formatHours(r.player_minutes)))),
      'Nothing yet.',
    );
    const weeks = peopleSlots(l.weekly, { key: 'period', total: 'unique_players', fresh: 'new_players', label: (r) => DAY_SHORT.format(at(r.period)), title: (r) => `week of ${r.period}` });
    weekChart.update({ slots: weeks, unit: 'week' });
    table(
      weekPeople.grid,
      ['Week of', ['Players', 'num'], ['New', 'num'], ['Regulars', 'num'], ['Hours', 'num'], ['Matches', 'num'], ['Stickiness', 'num']],
      [...l.weekly].reverse().map((r) => el('tr', {}, cell(r.period), number(r.unique_players), number(r.new_players ?? '–'), number(r.regulars), number(formatHours(r.player_minutes)), number(r.matches), number(r.stickiness === null ? '–' : shareOf(r.stickiness, 1)))),
      'Nothing yet.',
    );
  };

  const renderMonths = (l) => {
    months.chart.replaceChildren();
    const rows = [...l.monthly].reverse().map((r) => el('tr', {}, cell(MONTHS_SHORT.format(at(`${r.period}-01`))), number(r.unique_players), number(r.new_players ?? '–'), number(r.regulars), number(formatHours(r.player_minutes)), number(r.matches), number(r.stickiness === null ? '–' : shareOf(r.stickiness, 1))));
    table(months.grid, ['Month', ['Players', 'num'], ['New', 'num'], ['Regulars', 'num'], ['Hours', 'num'], ['Matches', 'num'], ['Stickiness', 'num']], rows, 'Nothing yet.');
    months.node.querySelector('.pt-details').open = true;
    months.node.querySelector('summary').hidden = true;
  };

  const renderCohorts = (l) => {
    cohorts.chart.replaceChildren();
    const tint = (w) => {
      const td = el('td', { className: 'num pt-tint', textContent: returnShare(w) });
      td.style.setProperty('--share', w.eligible === 0 ? '0' : String(w.returned / w.eligible));
      td.title = w.eligible === 0 ? 'Their days are not over yet' : `${w.returned} of ${w.eligible} came back`;
      return td;
    };
    const head = el('tr', {}, ...['Week of', 'New players', 'Back in 1 day', 'In 7 days', 'In 30 days', 'In 90 days'].map((h, i) => el('th', { scope: 'col', textContent: h, className: i === 0 ? '' : 'num' })));
    cohorts.grid.className = 'admin-table pt-cohorts';
    cohorts.grid.replaceChildren(el('thead', {}, head), el('tbody', {}, ...[...l.cohorts].reverse().map((c) => el('tr', {}, cell(c.week), number(c.new_players), ...c.windows.map(tint)))));
    if (l.cohorts.length === 0) table(cohorts.grid, ['Week of'], [], 'No new players yet.');
    cohorts.node.querySelector('.pt-details').open = true;
    cohorts.node.querySelector('summary').hidden = true;
  };

  const renderLines = (l, range) => {
    for (const x of lines) {
      // The 7-day average is worked out over every day kept and then cut to the range with the days.
      const { points, smooth } = croppedLine(l.daily, x.spec.pick, range, rolling);
      const format = FORMATS[x.spec.format];
      x.line.update({ points, smooth, format, label: x.spec.title, average: true });
      valueTable(x.grid, points, format, x.spec.title);
    }
  };

  const renderLeaves = (l) => {
    const { total, timing, finale } = lifetimeLeaves(l.daily);
    setStatus(leaves.noteNode, total === 0 ? 'Nobody has left in the days the bot kept stays.' : `Share of leaves by when in a match, over every day kept. ${shareOf(finale, total)} were in the night’s last match or after it.`);
    const bars = barLengths(LEAVE_TIMINGS.map(([key]) => timing[key]));
    leaves.chart.replaceChildren(barList(total === 0 ? [] : LEAVE_TIMINGS.map(([key, label], i) => ({ label, sub: `${timing[key]}`, length: bars[i] ?? 0, text: shareOf(timing[key], total) })), 'Nothing yet.'));
    table(leaves.grid, ['When', ['Leaves', 'num'], ['Share', 'num']], [...LEAVE_TIMINGS.map(([key, label]) => el('tr', {}, cell(label), number(timing[key]), number(shareOf(timing[key], total)))), el('tr', {}, cell('In the night’s last match or after'), number(finale), number(shareOf(finale, total)))], 'Nothing yet.');
  };

  const renderMaps = (l) => {
    const rows = l.maps.map((m) => ({ ...m, n: m.players_at_start, share: m.players_at_start === 0 ? null : m.left_early / m.players_at_start }));
    const hot = hottest(rows);
    const bars = barLengths(rows.map((r) => r.share ?? 0));
    maps.chart.replaceChildren(
      barList(
        rows.map((r, i) => ({
          label: r.map,
          sub: `${r.matches} ${r.matches === 1 ? 'match' : 'matches'}, ${whole(r.average_peak)} players at peak, ${r.with_scores === 0 ? 'no scores' : `${shareOf(r.one_sided, r.with_scores)} one-sided`}`,
          length: bars[i] ?? 0,
          text: r.share === null ? '–' : shareOf(r.left_early, r.n),
          hot: i === hot,
          thin: r.n < THIN_LEAST,
          title: r.n < THIN_LEAST ? `Only ${r.n} players: too few to say much` : '',
        })),
        'No matches kept yet.',
      ),
    );
    table(
      maps.grid,
      ['Map', ['Matches', 'num'], ['Players at peak', 'num'], ['Match length', 'num'], ['In game at start', 'num'], ['Left early', 'num'], ['Left', 'num'], ['One-sided', 'num']],
      l.maps.map((m) => el('tr', {}, cell(m.map), number(m.matches), number(whole(m.average_peak)), number(formatHours(m.average_minutes)), number(m.players_at_start), number(m.left_early), number(shareOf(m.left_early, m.players_at_start)), number(m.with_scores === 0 ? '–' : shareOf(m.one_sided, m.with_scores)))),
      'No matches kept yet.',
    );
  };

  return {
    text: (l) => lifetimeText(l),
    // `range` is a key of RANGES.
    render(l, range = 'all') {
      tiles.replaceChildren(
        ...lifetimeTiles(l).map((t) =>
          el('div', { className: 'tile' }, el('div', { className: 'tile-label', textContent: t.label }), el('div', { className: 'tile-value', textContent: t.value }), el('div', { className: 'tile-sub', textContent: t.sub })),
        ),
      );
      renderPeople(l);
      renderMonths(l);
      renderCohorts(l);
      renderLines(l, RANGES[range] ?? null);
      renderLeaves(l);
      renderMaps(l);
      drawHeatmap(heat.grid, heatNote, heat.chart, l.heat);
    },
  };
};
