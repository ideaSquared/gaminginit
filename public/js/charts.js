import { formatHours, niceScale, segments } from './format.js';

// Small hand-drawn SVG charts: a 24-hour population line and a daily-peak column chart.
// Both redraw at their container's real width so text stays crisp, and both work with a keyboard.

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

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dayNumber = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: 'UTC' });
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

    const labelEvery = band < 30 ? 2 : 1;
    root.replaceChildren(chart);
    const tip = makeTooltip(root);

    slots.forEach((slot, i) => {
      const cx = m.left + band * i + band / 2;
      const isToday = slot.day === today;
      if ((count - 1 - i) % labelEvery === 0) {
        const label = band >= 44 ? dayShort.format(slot.at) : dayNumber.format(slot.at);
        text(chart, { class: isToday ? 'tick tick-strong' : 'tick', x: cx, y: height - 8, 'text-anchor': 'middle' }, label);
      }
      const group = svg('g', { class: 'bar', tabindex: 0 }, chart);
      const description = slot.stats
        ? `${slot.stats.peak} players at peak, live ${formatHours(slot.stats.liveMinutes)}`
        : 'No readings';
      group.setAttribute('aria-label', `${dayLong.format(slot.at)}: ${description}`);
      svg('rect', { class: 'hit', x: cx - band / 2, y: m.top, width: band, height: plotH }, group);
      if (slot.stats && slot.stats.peak > 0) {
        const h = Math.max(1, y(0) - y(slot.stats.peak));
        svg('path', { class: 'column', d: columnPath(cx - barW / 2, y(slot.stats.peak), barW, h) }, group);
        // Only the best day and today carry a value; the tooltip and table have the rest.
        if (isToday || i === best) {
          text(chart, { class: 'cap-label', x: cx, y: y(slot.stats.peak) - 6, 'text-anchor': 'middle' }, String(slot.stats.peak));
        }
      }
      const show = () => {
        group.classList.add('active');
        tip.show(cx, slot.stats ? y(slot.stats.peak) : y(0), slot.stats ? `${slot.stats.peak} peak` : 'No data', `${dayLong.format(slot.at)}${slot.stats ? ` · live ${formatHours(slot.stats.liveMinutes)}` : ''}`);
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
