import { barLengths, busiestHourText, busyLevels, localWeek, publicLifetimeTiles, publicRecords, regularMeta, regularsText, shareOf } from './format.js';
import { watchArt } from './art-stats.js';
import { lineChart, peopleChart } from './trends.js';
import { el } from './views.js';

// The landing page's numbers: the server's final lifetime stats, saved from the bot's GET /api/lifetime into
// data/lifetime.json when the server closed. The bot is not needed any more.

const $ = (id) => document.getElementById(id);

const DAY_SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const at = (day) => Date.parse(`${day}T00:00:00Z`);
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const tableOf = (table, headings, rows) => {
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...headings.map((h) => el('th', { scope: 'col', textContent: h })))),
    el('tbody', {}, ...rows.map((row) => el('tr', {}, ...row.map((cell) => el('td', { textContent: String(cell) }))))),
  );
};

const legend = (...items) =>
  el('ul', { className: 'pt-legend' }, ...items.map(([className, name]) => el('li', {}, el('span', { className: `pt-key ${className}`, ariaHidden: 'true' }), name)));

// The regulars: who came on 14 or more days of the last 30, most days first. Names are the game's, so they go in as text.
const renderRegulars = (regulars) => {
  const shown = regulars && regulars.players.length > 0;
  $('lifetime-regulars').hidden = !shown;
  if (!shown) return;
  $('regulars-note').textContent = regularsText(regulars);
  $('regulars-list').replaceChildren(
    ...regulars.players.map((p, i) => {
      const name = el('span', { className: 'regular-name', textContent: p.name });
      return el(
        'li',
        { className: `regular${i < 3 ? ' regular-top' : ''}` },
        name,
        el('span', { className: 'regular-meta', textContent: regularMeta(p) }),
        el('span', { className: 'regular-since', textContent: `First seen ${p.since}` }),
        ...(p.founder ? [el('span', { className: 'regular-badge', textContent: 'There from the start' })] : []),
      );
    }),
  );
};

const render = (l) => {
  // Shown first, so the charts can measure themselves.
  $('lifetime').hidden = false;
  renderRegulars(l.regulars);
  $('lifetime-tiles').replaceChildren(
    ...publicLifetimeTiles(l).map(([label, value, sub]) =>
      el('div', { className: 'tile' }, el('p', { className: 'tile-label', textContent: label }), el('p', { className: 'tile-value', textContent: value }), el('p', { className: 'tile-sub', textContent: sub })),
    ),
  );
  $('lifetime-records').replaceChildren(...publicRecords(l).map((line) => el('li', { textContent: line })));
  $('lifetime-sub').textContent = `Everything from ${l.since} to ${l.through}. Days are UTC.`;

  const weeks = peopleChart($('weeks-chart'));
  weeks.update({
    unit: 'week',
    slots: l.weeks.map((w) => ({ key: w.week, label: DAY_SHORT.format(at(w.week)), title: `week of ${w.week}`, total: w.players, fresh: w.new_players })),
  });
  tableOf($('weeks-table'), ['Week of (UTC)', 'Players', 'New players'], [...l.weeks].reverse().map((w) => [w.week, w.players, w.new_players ?? '–']));

  const days = lineChart($('people-chart'));
  days.update({ points: l.days.map((d) => ({ day: d.day, value: d.players })), average: true, label: 'Players each day', format: (v) => `${Math.round(v)} players` });
  tableOf($('people-table'), ['Day (UTC)', 'Players'], [...l.days].reverse().map((d) => [d.day, d.players]));

  // When we are busiest, as the reader's own week.
  const week = l.busy === null ? null : localWeek(l.busy.players, new Date().getTimezoneOffset());
  $('lifetime-busy').hidden = week === null;
  if (week !== null) {
    $('busy-note').textContent = `${busiestHourText(week)} Average over ${l.busy.days} days, your local time.`.trim();
    const levels = busyLevels(week);
    const hours = Array.from({ length: 24 }, (_, h) => h);
    $('busy-grid').replaceChildren(
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', textContent: '' }), ...hours.map((h) => el('th', { scope: 'col', className: 'heat-hour', textContent: h % 3 === 0 ? String(h) : '' })))),
      el(
        'tbody',
        {},
        ...week.map((row, day) =>
          el(
            'tr',
            {},
            el('th', { scope: 'row', textContent: DAY_NAMES[day] }),
            ...row.map((v, h) => {
              const label = `${DAY_NAMES[day]} ${String(h).padStart(2, '0')}:00: ${v < 1 ? 'under 1' : `about ${Math.round(v)}`} players on average`;
              const td = el('td', { className: `heat-cell heat-${levels[day][h]}`, title: label, tabIndex: 0 });
              td.setAttribute('aria-label', label);
              const show = () => ($('busy-readout').textContent = label);
              td.addEventListener('focus', show);
              td.addEventListener('mouseenter', show);
              return td;
            }),
          ),
        ),
      ),
    );
  }

  // Favourite maps: each one's share of the matches played.
  const matches = l.maps.reduce((sum, m) => sum + m.matches, 0);
  const lengths = barLengths(l.maps.map((m) => m.matches));
  $('maps-bars').replaceChildren(
    ...l.maps.map((m, i) => {
      const fill = el('span', { className: 'pt-fill' });
      fill.style.width = `${Math.round((lengths[i] ?? 0) * 1000) / 10}%`;
      return el(
        'li',
        { className: 'pt-row' },
        el('span', { className: 'pt-label' }, m.map, el('span', { className: 'pt-sub', textContent: `${m.matches} ${m.matches === 1 ? 'match' : 'matches'}` })),
        el('span', { className: 'pt-track' }, fill),
        el('span', { className: 'pt-value', textContent: shareOf(m.matches, matches) }),
      );
    }),
  );
  $('lifetime-maps').hidden = l.maps.length === 0;

  tableOf(
    $('months-table'),
    ['Month', 'Players', 'New players', 'Hours played', 'Matches'],
    [...l.months].reverse().map((m) => [MONTH.format(at(`${m.month}-01`)), m.players, m.new_players ?? '–', m.hours.toLocaleString('en-GB'), m.matches]),
  );
  $('weeks-legend').replaceChildren(legend(['pt-key-returning', 'Players'], ['pt-key-new', 'New players']));
  $('people-legend').replaceChildren(legend(['pt-key-raw', 'Each day'], ['pt-key-avg', '7-day average']));
};

// What the page says in place of the figures, and nothing else.
const status = (text) => {
  $('lifetime-status').hidden = false;
  $('lifetime-status').textContent = text;
};

const load = async () => {
  try {
    const response = await fetch('data/lifetime.json', { headers: { accept: 'application/json' } });
    if (!response.ok) return status('We couldn’t load the numbers just now. Try again in a minute.');
    const data = await response.json();
    if (!data?.since) return status('There are no numbers to show.');
    $('lifetime-status').hidden = true;
    render(data);
  } catch {
    status('We couldn’t load the numbers just now. Try again in a minute.');
  }
};

load();

watchArt();
