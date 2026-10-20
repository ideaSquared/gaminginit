import {
  barLengths,
  bounceText,
  formatHours,
  heatGrid,
  hottest,
  JOIN_TIMINGS,
  LEAVE_TIMINGS,
  leftShare,
  newPlayersText,
  peakHourText,
  playtimeText,
  playtimeTiles,
  returnShare,
  seedingText,
  shareOf,
  THIN_LEAST,
} from './format.js';
import { cell, number, setStatus, table, when } from './staff.js';
import { el } from './views.js';

// The staff page's Play time view (Server, see server.js): headline figures, then a card for each question, each a chart
// with its numbers in a table under "Show as table". Bars are one hue and as long as their value. Where one row is the
// point (the map or kind of match that loses most players) it is picked out in the accent, and the rest stay quiet; a row
// with few players behind it (THIN_LEAST) is dimmed and never picked.

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const minutes = (value) => formatHours(value);

// One row of a bar list: `label` and `sub` on the left, the bar, and `text` after it. `length` is 0 to 1; `inner`, 0 to 1,
// is the part of the bar picked out (those in the night's last match, those still there at go-live).
const barRow = ({ label, sub = '', length, inner = null, text, hot = false, thin = false, title = '' }) => {
  const fill = el('span', { className: 'pt-fill' });
  fill.style.width = `${Math.round(length * 1000) / 10}%`;
  if (inner !== null) {
    const part = el('span', { className: 'pt-inner' });
    part.style.width = `${Math.round(inner * 1000) / 10}%`;
    fill.append(part);
  }
  return el(
    'li',
    { className: `pt-row${hot ? ' pt-hot' : ''}${thin ? ' pt-thin' : ''}`, title },
    el('span', { className: 'pt-label' }, label, ...(sub ? [el('span', { className: 'pt-sub', textContent: sub })] : [])),
    el('span', { className: 'pt-track' }, fill),
    el('span', { className: 'pt-value', textContent: text }),
  );
};

const barList = (rows, empty) => (rows.length === 0 ? el('p', { className: 'muted pt-empty', textContent: empty }) : el('ul', { className: 'pt-bars' }, ...rows.map(barRow)));

// A card: title, a line on how to read it, its chart, and its numbers as a table.
const card = (className, title, note) => {
  const chart = el('div', { className: 'pt-chart' });
  const grid = el('table', { className: 'admin-table' });
  const details = el('details', { className: 'pt-details' }, el('summary', { textContent: 'Show as table' }), el('div', { className: 'admin-scroll' }, grid));
  const noteNode = el('p', { className: 'section-note pt-note', textContent: note });
  const node = el('section', { className: `card pt-card ${className}` }, el('h3', { className: 'pt-title', textContent: title }), noteNode, chart, details);
  return { node, chart, grid, noteNode };
};

export const createPlaytime = (root) => {
  const tiles = el('div', { className: 'tiles pt-tiles' });
  const daily = card('pt-wide', 'Each day', 'How long a typical stay was, by the day it ended.');
  const lengths = card('', 'How long stays last', 'Share of stays by length.');
  const leaves = card(
    '',
    'When players leave',
    'Share of leaves by when in a match. The bright part of each bar is those in the night’s last match or after it.',
  );
  const maps = card('', 'By map', 'Share of players in game when the match went live who left before its last 3 minutes. The map that loses most is picked out.');
  const balance = card('', 'By how one-sided the match was', 'The same, by the winner’s lead over the other side as a share of its score.');
  const joins = card('', 'Stays by when people joined', 'Share who stayed 30 minutes or more, by when in a match they joined, with their median stay.');
  const seeding = card('', 'Seeding', '');
  const fresh = card('pt-wide', 'New players', '');
  const heat = card('pt-wide', 'Leaves by hour', 'Leaves per 100 hours of play, by hour of the week in UTC. Blank hours have under 10 hours of play. Hover or Tab to a cell to read it.');
  const matchesCard = card('pt-wide', 'Match by match', 'The latest matches: the share who were in game when it went live and stayed past its last 3 minutes.');
  const heatNote = el('p', { className: 'section-note pt-peak', ariaLive: 'polite' });
  const heatGridNode = heat.grid;
  heatGridNode.className = 'admin-table heatmap';
  heat.node.insertBefore(heatNote, heat.chart);
  const heatChart = heat.chart;
  // The heatmap is its own table, so the "Show as table" fold is not needed.
  heat.node.querySelector('.pt-details').replaceWith(el('div', { className: 'admin-scroll' }, heatGridNode));
  const cards = [daily, lengths, leaves, maps, balance, joins, seeding, fresh, heat, matchesCard];
  root.replaceChildren(tiles, el('div', { className: 'pt-grid' }, ...cards.map((c) => c.node)));

  const renderDaily = (json) => {
    const shown = json.daily;
    const top = Math.max(0, ...shown.map((d) => d.medianMinutes));
    const lengthsOf = barLengths(shown.map((d) => d.medianMinutes));
    daily.chart.replaceChildren(
      shown.length === 0
        ? el('p', { className: 'muted pt-empty', textContent: 'Nobody has left yet in this period.' })
        : el(
            'div',
            { className: `pt-cols${shown.length > 14 ? ' pt-cols-many' : ''}`, role: 'img', ariaLabel: `Typical stay by day, longest ${minutes(top)}` },
            ...shown.map((d, i) => {
              const bar = el('span', { className: 'pt-colbar' });
              bar.style.height = `${Math.max(2, Math.round((lengthsOf[i] ?? 0) * 100))}%`;
              return el(
                'div',
                { className: 'pt-col', title: `${d.day}: typical ${minutes(d.medianMinutes)}, average ${minutes(d.averageMinutes)}, ${d.players} players, ${d.sessions} stays` },
                el('span', { className: 'pt-colvalue', textContent: minutes(d.medianMinutes) }),
                el('span', { className: 'pt-colwell' }, bar),
                el('span', { className: 'pt-collabel', textContent: d.day.slice(8) }),
              );
            }),
          ),
    );
    table(
      daily.grid,
      ['Day', ['Players', 'num'], ['Stays', 'num'], ['Average stay', 'num'], ['Typical stay', 'num'], ['Per player', 'num']],
      shown.map((d) => el('tr', {}, cell(d.day), number(d.players), number(d.sessions), number(minutes(d.averageMinutes)), number(minutes(d.medianMinutes)), number(minutes(d.minutesPerPlayer)))),
      'Nobody has left yet in this period.',
    );
  };

  const renderLengths = (json) => {
    const total = json.lengths.reduce((sum, l) => sum + l.sessions, 0);
    const bars = barLengths(json.lengths.map((l) => l.sessions));
    lengths.chart.replaceChildren(
      total === 0
        ? el('p', { className: 'muted pt-empty', textContent: 'Nothing yet.' })
        : barList(
            json.lengths.map((l, i) => ({ label: l.label, sub: `${l.sessions}`, length: bars[i] ?? 0, text: shareOf(l.sessions, total) })),
            'Nothing yet.',
          ),
    );
    table(lengths.grid, ['Stay', ['Stays', 'num'], ['Share', 'num']], json.lengths.map((l) => el('tr', {}, cell(l.label), number(l.sessions), number(shareOf(l.sessions, total)))), 'Nothing yet.');
  };

  const renderLeaves = (json) => {
    const { total, timing, finale } = json.leaves;
    const last = Object.values(finale).reduce((a, b) => a + b, 0);
    const bars = barLengths(LEAVE_TIMINGS.map(([key]) => timing[key]));
    leaves.chart.replaceChildren(
      barList(
        total === 0
          ? []
          : LEAVE_TIMINGS.map(([key, label], i) => ({
              label,
              sub: `${timing[key]}`,
              length: bars[i] ?? 0,
              inner: timing[key] === 0 ? 0 : finale[key] / timing[key],
              text: shareOf(timing[key], total),
              title: `${label}: ${timing[key]} leaves, ${finale[key]} in the night’s last match or after`,
            })),
        'Nobody has left yet in this period.',
      ),
    );
    table(
      leaves.grid,
      ['When', ['Leaves', 'num'], ['Share', 'num'], ['In the night’s last match or after', 'num']],
      [
        ...LEAVE_TIMINGS.map(([key, label]) => el('tr', {}, cell(label), number(timing[key]), number(shareOf(timing[key], total)), number(finale[key]))),
        el('tr', {}, cell('All'), number(total), number(shareOf(total, total)), number(last)),
      ],
      'Nobody has left yet in this period.',
    );
  };

  // Maps and kinds of match: the share who left early, the worst picked out, those with few players dimmed.
  const renderLeft = (target, items, empty) => {
    const rows = items.map((r) => ({ label: r.label, n: r.present, share: r.present === 0 ? null : r.leftBefore / r.present, matches: r.matches, left: r.leftBefore }));
    const hot = hottest(rows);
    const bars = barLengths(rows.map((r) => r.share ?? 0));
    target.chart.replaceChildren(
      barList(
        rows.map((r, i) => ({
          label: r.label,
          sub: `${r.matches} ${r.matches === 1 ? 'match' : 'matches'}, ${r.n} players`,
          length: bars[i] ?? 0,
          text: r.share === null ? '–' : shareOf(r.left, r.n),
          hot: i === hot,
          thin: r.n < THIN_LEAST,
          title: r.n < THIN_LEAST ? `Only ${r.n} players: too few to say much` : '',
        })),
        empty,
      ),
    );
    table(
      target.grid,
      [target === maps ? 'Map' : 'Match', ['Matches', 'num'], ['In game at start', 'num'], ['Left before the end', 'num'], ['Left', 'num']],
      items.map((r) => el('tr', {}, cell(r.label), number(r.matches), number(r.present), number(r.leftBefore), number(leftShare(r)))),
      empty,
    );
  };

  const renderJoins = (json) => {
    const items = json.joins.filter((j) => j.sessions > 0);
    joins.chart.replaceChildren(
      barList(
        items.map((j) => ({
          label: JOIN_TIMINGS[j.timing] ?? j.timing,
          sub: `${j.sessions} stays, median ${minutes(j.medianMinutes)}`,
          length: j.stayedShare,
          text: shareOf(j.stayedShare, 1),
          thin: j.sessions < THIN_LEAST,
        })),
        'Nothing yet.',
      ),
    );
    table(
      joins.grid,
      ['Joined', ['Stays', 'num'], ['Median stay', 'num'], ['Stayed 30 min or more', 'num']],
      items.map((j) => el('tr', {}, cell(JOIN_TIMINGS[j.timing] ?? j.timing), number(j.sessions), number(minutes(j.medianMinutes)), number(shareOf(j.stayedShare, 1)))),
      'Nothing yet.',
    );
  };

  const renderSeeding = (json) => {
    setStatus(seeding.noteNode, `${seedingText(json.seeding)} The full bar is who was in game while it seeded; the bright part, who was still there at go-live.`);
    const top = Math.max(0, ...json.seeding.list.map((m) => m.seeders));
    const bars = barLengths(json.seeding.list.map((m) => m.seeders), top);
    seeding.chart.replaceChildren(
      barList(
        json.seeding.list.map((m, i) => ({
          label: m.map,
          sub: `${when.format(m.liveAt)}, seeded ${minutes(m.seedingMinutes)}`,
          length: bars[i] ?? 0,
          inner: m.seeders === 0 ? 0 : m.reachedLive / m.seeders,
          text: `${m.reachedLive} of ${m.seeders}`,
        })),
        'No match in this period started with the server seeding.',
      ),
    );
    table(
      seeding.grid,
      ['Match', ['Went live', 'num'], ['Seeded for', 'num'], ['In game while seeding', 'num'], ['There at go-live', 'num']],
      json.seeding.list.map((m) => el('tr', {}, cell(m.map), el('td', { className: 'num when', textContent: when.format(m.liveAt) }), number(minutes(m.seedingMinutes)), number(m.seeders), number(m.reachedLive))),
      'Nothing to show.',
    );
  };

  // The new players' weeks as a grid, each share tinted by how large it is.
  const renderNew = (json) => {
    const cohorts = json.newPlayers?.cohorts ?? [];
    setStatus(fresh.noteNode, json.newPlayers ? newPlayersText(json.newPlayers) : '');
    const tint = (w) => {
      const td = el('td', { className: 'num pt-tint', textContent: returnShare(w) });
      td.style.setProperty('--share', w.eligible === 0 ? '0' : String(w.returned / w.eligible));
      td.title = w.eligible === 0 ? 'Their days are not over yet' : `${w.returned} of ${w.eligible} came back`;
      return td;
    };
    const head = el('tr', {}, ...['Week of', 'New players', 'Back in 1 day', 'In 7 days', 'In 30 days'].map((h, i) => el('th', { scope: 'col', textContent: h, className: i === 0 ? '' : 'num' })));
    const body = cohorts.map((c) => el('tr', {}, cell(c.week), number(c.newPlayers), ...c.windows.map(tint)));
    fresh.chart.replaceChildren(
      cohorts.length === 0 ? el('p', { className: 'muted pt-empty', textContent: 'No new players yet.' }) : el('div', { className: 'admin-scroll' }, el('table', { className: 'admin-table pt-cohorts' }, el('thead', {}, head), el('tbody', {}, ...body))),
    );
    // The same numbers are already a table, so there is nothing to show under it.
    fresh.node.querySelector('.pt-details').hidden = true;
  };

  const renderHeat = (json) => {
    const grid = heatGrid(json.heat);
    setStatus(heatNote, peakHourText(grid));
    const hours = Array.from({ length: 24 }, (_, h) => h);
    heatGridNode.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', textContent: 'UTC' }), ...hours.map((h) => el('th', { scope: 'col', className: 'heat-hour', textContent: h % 3 === 0 ? String(h) : '' })))),
      el(
        'tbody',
        {},
        ...grid.map((row, day) =>
          el(
            'tr',
            {},
            el('th', { scope: 'row', textContent: DAY_NAMES[day] }),
            ...row.map((c, h) => {
              const text = `${DAY_NAMES[day]} ${String(h).padStart(2, '0')}:00 UTC: ${c.leaves} leaves in ${formatHours(c.minutes)} of play${c.rate === null ? ', too little to say' : ` (${Math.round(c.rate)} per 100 hours)`}`;
              const td = el('td', { className: `heat-cell heat-${c.level}`, title: text, tabIndex: 0 });
              td.setAttribute('aria-label', text);
              // A tooltip does not open from the keyboard, so the numbers are also written above the heatmap.
              const show = () => setStatus(heatNote, text);
              td.addEventListener('focus', show);
              td.addEventListener('mouseenter', show);
              td.addEventListener('mouseleave', () => setStatus(heatNote, peakHourText(grid)));
              td.addEventListener('blur', () => setStatus(heatNote, peakHourText(grid)));
              return td;
            }),
          ),
        ),
      ),
    );
    // The scale: from the quietest hour to the busiest.
    heatChart.replaceChildren(
      el(
        'div',
        { className: 'pt-scale' },
        el('span', { textContent: 'Fewer leaves' }),
        ...[1, 2, 3, 4].map((level) => el('span', { className: `pt-swatch heat-${level}`, ariaHidden: 'true' })),
        el('span', { textContent: 'More leaves' }),
      ),
    );
  };

  const renderMatches = (json) => {
    const items = json.matches;
    matchesCard.chart.replaceChildren(
      barList(
        items.map((m) => ({
          label: m.lastOfNight ? `${m.map} · last of the night` : m.map,
          sub: when.format(m.endedAt),
          length: m.present === 0 ? 0 : (m.present - m.leftBefore) / m.present,
          text: m.present === 0 ? '–' : `${shareOf(m.present - m.leftBefore, m.present)} of ${m.present}`,
          thin: m.present < THIN_LEAST,
        })),
        'No matches finished in this period.',
      ),
    );
    table(
      matchesCard.grid,
      ['Match', ['Ended', 'num'], ['In game at start', 'num'], ['Left before the end', 'num'], ['Stayed', 'num']],
      items.map((m) =>
        el('tr', {}, cell(m.lastOfNight ? `${m.map} (last of the night)` : m.map), el('td', { className: 'num when', textContent: when.format(m.endedAt) }), number(m.present), number(m.leftBefore), number(shareOf(m.present - m.leftBefore, m.present))),
      ),
      'No matches finished in this period.',
    );
  };

  return {
    // The headline line, as text, for the status line under the title.
    text: (json) => `${playtimeText(json)} ${bounceText(json.bounce)}`.trim(),
    render(json) {
      tiles.replaceChildren(
        ...playtimeTiles(json).map((t) =>
          el('div', { className: 'tile' }, el('div', { className: 'tile-label', textContent: t.label }), el('div', { className: 'tile-value', textContent: t.value }), el('div', { className: 'tile-sub', textContent: t.sub })),
        ),
      );
      renderDaily(json);
      renderLengths(json);
      renderLeaves(json);
      renderMatches(json);
      // An older bot's answer has none of the rest.
      for (const c of [maps, balance, joins, seeding, fresh, heat]) c.node.hidden = !json.byMap;
      if (!json.byMap) return;
      renderLeft(maps, json.byMap.map((m) => ({ ...m, label: m.map })), 'No matches finished in this period.');
      renderLeft(balance, json.byBalance.filter((b) => b.matches > 0), 'No matches with scores in this period.');
      renderJoins(json);
      renderSeeding(json);
      renderNew(json);
      renderHeat(json);
    },
  };
};
