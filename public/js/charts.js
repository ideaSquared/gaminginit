import { clockHour, formatHours, heatLevel, kd, monthStarts, niceScale, ordinal, played, playerCount, segments, timeRange } from './format.js';

// Small hand-drawn SVG charts: a 24-hour population line, daily-peak and busy-times columns, and on player pages an
// activity calendar and kills per match. Each redraws at its container's real width so text stays crisp, and each
// works with a keyboard.

const SVG_NS = 'http://www.w3.org/2000/svg';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const svg = (tag, attrs = {}, parent = null) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  parent?.appendChild(node);
  return node;
};

const text = (parent, attrs, content) => {
  const node = svg('text', attrs, parent);
  node.textContent = content;
  return node;
};

const clock = new Intl.DateTimeFormat(undefined, { hour: clockHour(), minute: '2-digit' });
const dayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dayNumber = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// One tooltip per chart. Values lead, labels follow; everything goes in with textContent.
const makeTooltip = (root) => {
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  root.appendChild(tip);
  return {
    show(x, y, value, label) {
      const strong = document.createElement('strong');
      strong.textContent = value;
      const small = document.createElement('span');
      small.textContent = label;
      tip.replaceChildren(strong, small);
      tip.hidden = false;
      const width = root.clientWidth;
      const tipWidth = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(x - tipWidth / 2, 0), width - tipWidth)}px`;
      tip.style.top = `${Math.max(y - tip.offsetHeight - 12, 0)}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
};

const onResize = (root, draw) => {
  let width = 0;
  new ResizeObserver(() => {
    if (root.clientWidth !== width) {
      width = root.clientWidth;
      draw();
    }
  }).observe(root);
};

const emptyMessage = (root, message) => {
  const p = document.createElement('p');
  p.className = 'chart-empty';
  p.textContent = message;
  root.replaceChildren(p);
};

// data: { history: [at, players][], capacity, live, now }
export const populationChart = (root) => {
  let data = null;

  const draw = () => {
    if (data === null) return;
    const { history, capacity, live, now } = data;
    const start = now - DAY;
    const samples = history.filter(([at]) => at >= start);
    if (samples.length === 0) {
      emptyMessage(root, 'No readings in the last 24 hours yet. The chart fills in as the bot checks the server.');
      return;
    }

    const width = root.clientWidth;
    const height = width < 480 ? 200 : 240;
    const m = { top: 16, right: 44, bottom: 28, left: 32 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const top = capacity > 0 ? capacity : niceScale(Math.max(...samples.map(([, p]) => p), live)).max;
    const ticks = niceScale(top).ticks.filter((t) => t <= top);
    const x = (at) => m.left + ((at - start) / DAY) * plotW;
    const y = (players) => m.top + plotH - (Math.min(players, top) / top) * plotH;

    const chart = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });

    for (const tick of ticks) {
      svg('line', { class: 'grid', x1: m.left, x2: m.left + plotW, y1: y(tick), y2: y(tick) }, chart);
      text(chart, { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, String(tick));
    }
    svg('line', { class: 'baseline', x1: m.left, x2: m.left + plotW, y1: y(0), y2: y(0) }, chart);

    // Hour labels every 6 hours of local time (every 12 on narrow screens).
    const every = plotW < 360 ? 12 : 6;
    const first = new Date(start);
    first.setMinutes(0, 0, 0);
    for (let at = first.getTime() + HOUR; at <= now; at += HOUR) {
      if (new Date(at).getHours() % every !== 0) continue;
      text(chart, { class: 'tick', x: x(at), y: height - 8, 'text-anchor': 'middle' }, clock.format(at));
    }

    if (live <= top) {
      svg('line', { class: 'threshold', x1: m.left, x2: m.left + plotW, y1: y(live), y2: y(live) }, chart);
      text(chart, { class: 'threshold-label', x: m.left + 6, y: y(live) - 6 }, `Live at ${live}`);
    }

    for (const part of segments(samples)) {
      const line = part.map(([at, p], i) => `${i === 0 ? 'M' : 'L'}${x(at).toFixed(1)},${y(p).toFixed(1)}`).join('');
      if (part.length === 1) {
        svg('circle', { class: 'dot', cx: x(part[0][0]), cy: y(part[0][1]), r: 3 }, chart);
        continue;
      }
      const lastX = x(part[part.length - 1][0]).toFixed(1);
      const firstX = x(part[0][0]).toFixed(1);
      svg('path', { class: 'area', d: `${line}L${lastX},${y(0)}L${firstX},${y(0)}Z` }, chart);
      svg('path', { class: 'line', d: line }, chart);
    }

    // The latest reading gets an end dot and its value.
    const [lastAt, lastPlayers] = samples[samples.length - 1];
    svg('circle', { class: 'end-dot', cx: x(lastAt), cy: y(lastPlayers), r: 4 }, chart);
    text(chart, { class: 'end-label', x: x(lastAt) + 8, y: y(lastPlayers), 'dominant-baseline': 'middle' }, String(lastPlayers));

    const cross = svg('line', { class: 'crosshair', y1: m.top, y2: m.top + plotH, visibility: 'hidden' }, chart);
    const focusDot = svg('circle', { class: 'end-dot', r: 4, visibility: 'hidden' }, chart);

    root.replaceChildren(chart);
    const tip = makeTooltip(root);

    let index = -1;
    const nearest = (px) => {
      const at = start + ((px - m.left) / plotW) * DAY;
      let lo = 0;
      let hi = samples.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid][0] < at) lo = mid + 1;
        else hi = mid;
      }
      const before = samples[lo - 1];
      return before && at - before[0] < samples[lo][0] - at ? lo - 1 : lo;
    };
    const showAt = (i) => {
      index = Math.max(0, Math.min(samples.length - 1, i));
      const [at, players] = samples[index];
      for (const [node, attrs] of [
        [cross, { x1: x(at), x2: x(at), visibility: 'visible' }],
        [focusDot, { cx: x(at), cy: y(players), visibility: 'visible' }],
      ]) {
        for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
      }
      tip.show(x(at), y(players), `${players} player${players === 1 ? '' : 's'}`, clock.format(at));
    };
    const hide = () => {
      cross.setAttribute('visibility', 'hidden');
      focusDot.setAttribute('visibility', 'hidden');
      tip.hide();
    };

    root.onpointermove = (event) => showAt(nearest(event.clientX - root.getBoundingClientRect().left));
    root.onpointerleave = hide;
    root.onblur = hide;
    root.onkeydown = (event) => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
      if (event.key === 'Escape') return hide();
      if (!(event.key in moves)) return;
      event.preventDefault();
      const step = moves[event.key];
      showAt(Number.isFinite(step) ? (index < 0 ? samples.length - 1 : index + step) : step < 0 ? 0 : samples.length - 1);
    };
  };

  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};

// Rounded top, square base: the data end is the only rounded end.
const columnPath = (x, y, w, h) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

// data: { days: {day, peak, liveMinutes}[], today: 'YYYY-MM-DD', count }
export const dailyChart = (root) => {
  let data = null;

  const draw = () => {
    if (data === null) return;
    const { days, today, count } = data;
    const byDay = new Map(days.map((d) => [d.day, d]));
    const end = Date.parse(`${today}T00:00:00Z`);
    const slots = Array.from({ length: count }, (_, i) => {
      const at = end - (count - 1 - i) * DAY;
      const day = new Date(at).toISOString().slice(0, 10);
      return { at, day, stats: byDay.get(day) ?? null };
    });
    if (slots.every((s) => s.stats === null)) {
      emptyMessage(root, 'No daily numbers yet. Each day’s peak appears here once the bot has been running.');
      return;
    }

    const width = root.clientWidth;
    const height = width < 480 ? 180 : 200;
    const m = { top: 20, right: 8, bottom: 28, left: 32 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const peaks = slots.map((s) => s.stats?.peak ?? 0);
    const { max, ticks } = niceScale(Math.max(...peaks), 3);
    const band = plotW / count;
    const barW = Math.min(24, band * 0.6);
    const y = (v) => m.top + plotH - (v / max) * plotH;
    // The best day gets a label once, even when several days tie; the newest of them wins.
    const best = peaks.lastIndexOf(Math.max(...peaks));

    const chart = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
    chart.setAttribute('role', 'group');
    chart.setAttribute('aria-label', 'Daily peak players');

    for (const tick of ticks) {
      svg('line', { class: 'grid', x1: m.left, x2: m.left + plotW, y1: y(tick), y2: y(tick) }, chart);
      text(chart, { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, String(tick));
    }
    svg('line', { class: 'baseline', x1: m.left, x2: m.left + plotW, y1: y(0), y2: y(0) }, chart);

    // Every other day on narrow screens, counting back from today so today is always labelled. A label says its month
    // where the month starts, so "1 Oct" shows where September ends. With room, it has the weekday too; the month
    // label is the longest, so it needs the most.
    const labelEvery = band < 34 ? 2 : 1;
    const shown = slots.map((_, i) => (count - 1 - i) % labelEvery === 0);
    const withMonth = monthStarts(slots.map((s) => s.at), shown);
    const labelFormat = (month) => {
      if (band >= 56) return month ? dayLong : dayShort;
      if (band >= 50 && !month) return dayShort;
      return month ? dayMonth : dayNumber;
    };
    root.replaceChildren(chart);
    const tip = makeTooltip(root);

    slots.forEach((slot, i) => {
      const cx = m.left + band * i + band / 2;
      const isToday = slot.day === today;
      if (shown[i]) {
        text(chart, { class: isToday ? 'tick tick-strong' : 'tick', x: cx, y: height - 8, 'text-anchor': 'middle' }, labelFormat(withMonth[i]).format(slot.at));
      }
      const group = svg('g', { class: 'bar', tabindex: 0 }, chart);
      // Today is not over, so its peak is only the peak so far.
      const sofar = isToday ? ' so far' : '';
      const description = slot.stats
        ? `${slot.stats.peak} players at peak${sofar}, live ${formatHours(slot.stats.liveMinutes)}`
        : 'No readings';
      group.setAttribute('aria-label', `${dayLong.format(slot.at)}: ${description}`);
      svg('rect', { class: 'hit', x: cx - band / 2, y: m.top, width: band, height: plotH }, group);
      if (slot.stats && slot.stats.peak > 0) {
        const h = Math.max(1, y(0) - y(slot.stats.peak));
        svg('path', { class: isToday ? 'column column-partial' : 'column', d: columnPath(cx - barW / 2, y(slot.stats.peak), barW, h) }, group);
        // Only the best day and today carry a value; the tooltip and table have the rest.
        if (isToday || i === best) {
          text(chart, { class: 'cap-label', x: cx, y: y(slot.stats.peak) - 6, 'text-anchor': 'middle' }, String(slot.stats.peak));
        }
      }
      const show = () => {
        group.classList.add('active');
        tip.show(cx, slot.stats ? y(slot.stats.peak) : y(0), slot.stats ? `${slot.stats.peak} peak${sofar}` : 'No data', `${dayLong.format(slot.at)}${slot.stats ? ` · live ${formatHours(slot.stats.liveMinutes)}` : ''}`);
      };
      const hide = () => {
        group.classList.remove('active');
        tip.hide();
      };
      group.addEventListener('pointerenter', show);
      group.addEventListener('pointerleave', hide);
      group.addEventListener('focus', show);
      group.addEventListener('blur', hide);
    });
  };

  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};

// "7:00 PM" or "19:00", for an hour of the day in local time.
export const hourLabel = (hour) => clock.format(new Date(2000, 0, 1, hour));

// "7:00 – 10:00 PM" or "19:00–22:00": `length` hours from `hour`, wrapping past midnight.
export const hourRange = (hour, length = 1) => timeRange(clock, new Date(2000, 0, 1, hour), new Date(2000, 0, 1, (hour + length) % 24));

// Average players in each hour of the day. The busy hours are in the series colour and the rest in gray, so the
// reader sees when to play before reading any numbers.
// data: { averages: (number | null)[24], busy: boolean[24], period: 'the last 14 days' }
export const busiestChart = (root) => {
  let data = null;

  const draw = () => {
    if (data === null) return;
    const { averages, busy, period } = data;
    if (averages.every((a) => a === null)) {
      emptyMessage(root, `No readings in ${period} yet.`);
      return;
    }
    if (averages.every((a) => !a)) {
      emptyMessage(root, `Nobody has played in ${period}.`);
      return;
    }

    const width = root.clientWidth;
    const height = width < 480 ? 140 : 160;
    const m = { top: 20, right: 8, bottom: 28, left: 32 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const values = averages.map((a) => a ?? 0);
    const most = Math.max(...values);
    const { max, ticks } = niceScale(most, 3);
    const band = plotW / 24;
    const barW = Math.min(24, band * 0.7);
    const y = (v) => m.top + plotH - (v / max) * plotH;
    // Only the busiest single hour carries its value; the tooltip and table have the rest.
    const label = values.indexOf(most);

    const chart = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    for (const tick of ticks) {
      svg('line', { class: 'grid', x1: m.left, x2: m.left + plotW, y1: y(tick), y2: y(tick) }, chart);
      text(chart, { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, String(tick));
    }
    svg('line', { class: 'baseline', x1: m.left, x2: m.left + plotW, y1: y(0), y2: y(0) }, chart);

    const every = band * 3 < 56 ? 6 : 3;
    const groups = averages.map((average, hour) => {
      const cx = m.left + band * hour + band / 2;
      if (hour % every === 0) text(chart, { class: 'tick', x: cx, y: height - 8, 'text-anchor': 'middle' }, hourLabel(hour));
      const group = svg('g', { class: 'bar' }, chart);
      svg('rect', { class: 'hit', x: cx - band / 2, y: m.top, width: band, height: plotH }, group);
      if (average > 0) {
        const h = Math.max(1, y(0) - y(average));
        svg('path', { class: busy[hour] ? 'column' : 'column column-quiet', d: columnPath(cx - barW / 2, y(average), barW, h) }, group);
      }
      if (hour === label) text(chart, { class: 'cap-label', x: cx, y: y(average) - 6, 'text-anchor': 'middle' }, String(Math.round(average)));
      return { group, cx, average };
    });

    root.replaceChildren(chart);
    const tip = makeTooltip(root);

    let index = -1;
    const showAt = (i) => {
      groups[index]?.group.classList.remove('active');
      index = Math.max(0, Math.min(23, i));
      const { group, cx, average } = groups[index];
      group.classList.add('active');
      const value = average === null ? 'No readings' : `${playerCount(Math.round(average))} on average`;
      const hours = `${hourRange(index)}${busy[index] ? ' · busy' : ''}`;
      tip.show(cx, y(average ?? 0), value, hours);
      return `${hours}: ${value}`;
    };
    const hide = () => {
      groups[index]?.group.classList.remove('active');
      tip.hide();
    };

    root.onpointermove = (event) => showAt(Math.floor((event.clientX - root.getBoundingClientRect().left - m.left) / band));
    root.onpointerleave = hide;
    root.onblur = hide;
    root.onkeydown = (event) => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
      if (event.key === 'Escape') return hide();
      if (!(event.key in moves)) return;
      event.preventDefault();
      const step = moves[event.key];
      // The chart is one image to a screen reader, so the hour it lands on is read out from the live region.
      const first = Math.max(0, busy.indexOf(true));
      live.textContent = showAt(Number.isFinite(step) ? (index < 0 ? first : index + step) : step < 0 ? 0 : 23);
    };
  };

  const live = document.createElement('p');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  root.after(live);

  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};

// A live region beside a chart, for the value a keyboard user lands on: the chart is one image to a screen reader.
const liveRegion = (root) => {
  const live = document.createElement('p');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  root.after(live);
  return live;
};

const KEY_MOVES = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };

const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const utc = (day) => Date.parse(`${day}T00:00:00Z`);
// When a match ended, in the reader's own time.
const dayLocal = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// What a player did on a calendar day, for its tooltip and the live region.
const dayDetail = (d) => {
  if (!d) return { value: 'Not on', label: '' };
  const parts = [`${d.matches} match${d.matches === 1 ? '' : 'es'}`];
  if (d.kills > 0) parts.push(`${d.kills} kills`);
  if (d.seedDays > 0) parts.push('seed day');
  return { value: `${formatHours(played(d))} played`, label: parts.join(' · ') };
};

// GitHub-style: a column per week, Monday at the top, each UTC day shaded by the time played.
// data: { weeks: (day | null)[7][], byDay: Map<day, activity day> }
export const activityCalendar = (root) => {
  let data = null;
  const live = liveRegion(root);

  const draw = () => {
    if (data === null) return;
    const { weeks, byDay } = data;
    const width = root.clientWidth;
    const m = { top: 18, left: 32 };
    const gap = 3;
    const cell = Math.max(8, Math.min(22, Math.floor((width - m.left) / weeks.length) - gap));
    const height = m.top + 7 * (cell + gap);
    const chart = svg('svg', { width: m.left + weeks.length * (cell + gap), height, 'aria-hidden': 'true' });

    for (const row of [0, 2, 4]) {
      const sample = weeks.flat().find((day, i) => day !== null && i % 7 === row);
      if (sample) text(chart, { class: 'tick', x: m.left - 8, y: m.top + row * (cell + gap) + cell / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, weekdayShort.format(utc(sample)));
    }

    const cells = [];
    let lastMonth = '';
    weeks.forEach((week, w) => {
      const x = m.left + w * (cell + gap);
      const first = week.find((day) => day !== null);
      if (first) {
        const month = first.slice(0, 7);
        if (month !== lastMonth && (w > 0 || Number(first.slice(8)) <= 7)) {
          text(chart, { class: 'tick', x, y: 11 }, monthShort.format(utc(first)));
        }
        lastMonth = month;
      }
      week.forEach((day, d) => {
        if (day === null) return;
        const stats = byDay.get(day);
        const y = m.top + d * (cell + gap);
        const rect = svg('rect', { class: `heat heat-${heatLevel(stats ? played(stats) : 0)}`, x, y, width: cell, height: cell, rx: 3 }, chart);
        cells.push({ day, stats, rect, x: x + cell / 2, y });
      });
    });

    root.replaceChildren(chart);
    const tip = makeTooltip(root);
    let index = -1;
    const showAt = (i) => {
      cells[index]?.rect.classList.remove('active');
      index = Math.max(0, Math.min(cells.length - 1, i));
      const { day, stats, rect, x, y } = cells[index];
      rect.classList.add('active');
      const { value, label } = dayDetail(stats);
      const when = dayLong.format(utc(day));
      tip.show(x, y, value, label ? `${when} · ${label}` : when);
      return `${when}: ${value}${label ? `, ${label}` : ''}`;
    };
    const hide = () => {
      cells[index]?.rect.classList.remove('active');
      tip.hide();
    };
    cells.forEach((c, i) => c.rect.addEventListener('pointerenter', () => showAt(i)));
    root.onpointerleave = hide;
    root.onblur = hide;
    // Left and right move a week, up and down a day, as the grid is laid out.
    root.onkeydown = (event) => {
      const moves = { ...KEY_MOVES, ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
      if (event.key === 'Escape') return hide();
      if (!(event.key in moves)) return;
      event.preventDefault();
      const step = moves[event.key];
      live.textContent = showAt(Number.isFinite(step) ? (index < 0 ? cells.length - 1 : index + step) : step < 0 ? 0 : cells.length - 1);
    };
  };

  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};

const RESULT_MARK = { won: 'W', lost: 'L' };

// Kills in each of a player's latest matches, oldest on the left, with their average as a line and each match's
// result (W or L) under its column.
// data: { matches: player matches, oldest first }
export const formChart = (root) => {
  let data = null;
  const live = liveRegion(root);

  const draw = () => {
    if (data === null) return;
    const { matches } = data;
    if (matches.length === 0) {
      emptyMessage(root, 'No matches in the last 90 days yet.');
      return;
    }
    const width = root.clientWidth;
    const height = width < 480 ? 170 : 190;
    const m = { top: 20, right: 8, bottom: 30, left: 32 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const average = matches.reduce((sum, match) => sum + match.kills, 0) / matches.length;
    const { max, ticks } = niceScale(Math.max(...matches.map((match) => match.kills), average), 3);
    const band = plotW / Math.max(matches.length, 10);
    const barW = Math.min(24, band * 0.7);
    const y = (v) => m.top + plotH - (v / max) * plotH;
    const best = matches.reduce((b, match, i) => (match.kills > matches[b].kills ? i : b), 0);

    const chart = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    for (const tick of ticks) {
      svg('line', { class: 'grid', x1: m.left, x2: m.left + plotW, y1: y(tick), y2: y(tick) }, chart);
      text(chart, { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, String(tick));
    }
    svg('line', { class: 'baseline', x1: m.left, x2: m.left + plotW, y1: y(0), y2: y(0) }, chart);

    const groups = matches.map((match, i) => {
      const cx = m.left + band * i + band / 2;
      const group = svg('g', { class: 'bar' }, chart);
      svg('rect', { class: 'hit', x: cx - band / 2, y: m.top, width: band, height: plotH }, group);
      if (match.kills > 0) {
        svg('path', { class: 'column', d: columnPath(cx - barW / 2, y(match.kills), barW, Math.max(1, y(0) - y(match.kills))) }, group);
      }
      if (i === best && match.kills > 0) text(chart, { class: 'cap-label', x: cx, y: y(match.kills) - 6, 'text-anchor': 'middle' }, String(match.kills));
      const mark = RESULT_MARK[match.result] ?? '–';
      text(chart, { class: `tick result-mark${match.result === 'won' ? ' tick-strong' : ''}`, x: cx, y: height - 10, 'text-anchor': 'middle' }, mark);
      return { group, cx, match };
    });

    svg('line', { class: 'threshold', x1: m.left, x2: m.left + plotW, y1: y(average), y2: y(average), 'stroke-dasharray': '4 4' }, chart);
    text(chart, { class: 'threshold-label', x: m.left + plotW, y: y(average) - 6, 'text-anchor': 'end' }, `avg ${average.toFixed(1)}`);

    root.replaceChildren(chart);
    const tip = makeTooltip(root);
    let index = -1;
    const showAt = (i) => {
      groups[index]?.group.classList.remove('active');
      index = Math.max(0, Math.min(groups.length - 1, i));
      const { group, cx, match } = groups[index];
      group.classList.add('active');
      const value = `${match.kills} kills, ${match.deaths} deaths`;
      const result = match.result ? `${match.result} · ` : '';
      const label = `${match.map} · ${result}${ordinal(match.place)} of ${match.players} · K/D ${kd(match.kills, match.deaths)} · ${dayLocal.format(match.endedAt)}`;
      tip.show(cx, y(match.kills), value, label);
      return `${value}. ${label}`;
    };
    const hide = () => {
      groups[index]?.group.classList.remove('active');
      tip.hide();
    };
    root.onpointermove = (event) => {
      const i = Math.floor((event.clientX - root.getBoundingClientRect().left - m.left) / band);
      if (i >= 0 && i < groups.length) showAt(i);
    };
    root.onpointerleave = hide;
    root.onblur = hide;
    root.onkeydown = (event) => {
      if (event.key === 'Escape') return hide();
      if (!(event.key in KEY_MOVES)) return;
      event.preventDefault();
      const step = KEY_MOVES[event.key];
      live.textContent = showAt(Number.isFinite(step) ? (index < 0 ? groups.length - 1 : index + step) : step < 0 ? 0 : groups.length - 1);
    };
  };

  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};
