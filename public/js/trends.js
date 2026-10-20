import { columnPath, emptyMessage, makeTooltip, onResize, svg, text } from './charts.js';
import { niceScale } from './format.js';

// Charts over many days for the staff page's Lifetime view (lifetime.js): a line of a daily figure with its 7-day average,
// and stacked columns of players by day or week, the new ones picked out. Built like the other charts (charts.js): they
// redraw at their container's width, show a crosshair and tooltip on hover, and work from the keyboard (Tab to the
// chart, then ← → Home End). Each has its numbers in a table next to it, as the page puts one under "Show as table".

const DAY = 86_400_000;
const dayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });

const at = (day) => Date.parse(`${day}T00:00:00Z`);

// The average of each value and the six before it, over those that have a value. A gap stays a gap.
export const rolling = (values, window = 7) =>
  values.map((v, i) => {
    if (v === null || v === undefined) return null;
    const part = values.slice(Math.max(0, i - window + 1), i + 1).filter((x) => x !== null && x !== undefined);
    return part.reduce((a, b) => a + b, 0) / part.length;
  });

// Hover, touch and keyboard for a chart whose points are at `xs` (pixels from the container's left): `show(i)` for the
// nearest, `hide()` when it leaves.
const scrub = (root, xs, show, hide) => {
  let index = -1;
  const nearest = (px) => xs.reduce((best, x, i) => (Math.abs(x - px) < Math.abs((xs[best] ?? Infinity) - px) ? i : best), 0);
  const go = (i) => {
    index = Math.max(0, Math.min(xs.length - 1, i));
    show(index);
  };
  root.tabIndex = 0;
  root.onpointermove = (event) => go(nearest(event.clientX - root.getBoundingClientRect().left));
  root.onpointerleave = () => hide();
  root.onblur = () => hide();
  root.onkeydown = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (event.key === 'Escape') return hide();
    if (!(event.key in moves)) return;
    event.preventDefault();
    const step = moves[event.key];
    go(Number.isFinite(step) ? (index < 0 ? xs.length - 1 : index + step) : step < 0 ? 0 : xs.length - 1);
  };
};

// The labels along the bottom: about one in `every` points, always the last, the first only if there is room.
const labelPoints = (count, plotW, minGap = 64) => {
  const every = Math.max(1, Math.ceil(minGap / (plotW / Math.max(1, count - 1))));
  return Array.from({ length: count }, (_, i) => (count - 1 - i) % every === 0);
};

// A line over the days. data: { points: { day, value: number | null }[], format: (value) => string, label: string,
// average: boolean }. The daily values are the quiet line, the 7-day average the one to read.
export const lineChart = (root) => {
  let data = null;
  const draw = () => {
    if (data === null) return;
    const { points, format, label, average } = data;
    const known = points.filter((p) => p.value !== null);
    if (known.length === 0) {
      emptyMessage(root, 'Nothing here yet.');
      return;
    }
    const width = root.clientWidth;
    // Not on screen yet (a hidden section): the resize observer draws it when it is.
    if (width < 120) return;
    const height = width < 480 ? 190 : 220;
    const m = { top: 16, right: 12, bottom: 28, left: 40 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const smooth = average ? rolling(points.map((p) => p.value)) : null;
    const { max, ticks } = niceScale(Math.max(...known.map((p) => p.value)), 3);
    const t0 = at(points[0].day);
    const span = Math.max(DAY, at(points[points.length - 1].day) - t0);
    const x = (day) => m.left + ((at(day) - t0) / span) * plotW;
    const y = (v) => m.top + plotH - (v / max) * plotH;

    const chart = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    for (const tick of ticks) {
      svg('line', { class: 'grid', x1: m.left, x2: m.left + plotW, y1: y(tick), y2: y(tick) }, chart);
      text(chart, { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, format(tick, true));
    }
    svg('line', { class: 'baseline', x1: m.left, x2: m.left + plotW, y1: y(0), y2: y(0) }, chart);
    labelPoints(points.length, plotW).forEach((on, i) => on && text(chart, { class: 'tick', x: x(points[i].day), y: height - 8, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle' }, dayLabel.format(at(points[i].day))));

    // A line drawn in runs, so a day with no value is a gap, not a line to zero.
    const runs = (values) => {
      const out = [];
      let run = [];
      values.forEach((v, i) => {
        if (v === null) {
          if (run.length > 0) out.push(run);
          run = [];
        } else run.push([x(points[i].day), y(v)]);
      });
      if (run.length > 0) out.push(run);
      return out;
    };
    const draw1 = (values, className) => {
      for (const run of runs(values)) {
        if (run.length === 1) svg('circle', { class: className === 'line' ? 'dot' : 'dot dot-quiet', cx: run[0][0], cy: run[0][1], r: 2.5 }, chart);
        else svg('path', { class: className, d: run.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join('') }, chart);
      }
    };
    if (smooth === null) draw1(points.map((p) => p.value), 'line');
    else {
      draw1(points.map((p) => p.value), 'line line-raw');
      draw1(smooth, 'line');
    }

    const cross = svg('line', { class: 'crosshair', y1: m.top, y2: m.top + plotH, visibility: 'hidden' }, chart);
    const dot = svg('circle', { class: 'end-dot', r: 4, visibility: 'hidden' }, chart);
    root.replaceChildren(chart);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', `${label}: ${format(known[known.length - 1].value)} on the latest day. Use the arrow keys to read the days.`);
    const tip = makeTooltip(root);
    const atX = points.map((p) => x(p.day));
    scrub(
      root,
      atX,
      (i) => {
        const p = points[i];
        const shown = smooth?.[i] ?? p.value;
        for (const [node, attrs] of [
          [cross, { x1: atX[i], x2: atX[i], visibility: 'visible' }],
          [dot, { cx: atX[i], cy: shown === null ? -10 : y(shown), visibility: shown === null ? 'hidden' : 'visible' }],
        ]) for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
        tip.show(atX[i], shown === null ? y(0) : y(shown), p.value === null ? 'No data' : format(p.value), `${dayLong.format(at(p.day))}${smooth && smooth[i] !== null ? ` · 7-day average ${format(smooth[i])}` : ''}`);
      },
      () => {
        cross.setAttribute('visibility', 'hidden');
        dot.setAttribute('visibility', 'hidden');
        tip.hide();
      },
    );
  };
  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};

// Columns of players by day or week: the returning ones, with the new ones on top in the accent. data: { slots: { key,
// label, total, fresh: number | null }[], unit: 'day' | 'week' }.
export const peopleChart = (root) => {
  let data = null;
  const draw = () => {
    if (data === null) return;
    const { slots, unit } = data;
    if (slots.length === 0) {
      emptyMessage(root, 'Nothing here yet.');
      return;
    }
    const width = root.clientWidth;
    if (width < 120) return;
    const height = width < 480 ? 190 : 220;
    const m = { top: 12, right: 8, bottom: 28, left: 40 };
    const plotW = width - m.left - m.right;
    const plotH = height - m.top - m.bottom;
    const { max, ticks } = niceScale(Math.max(...slots.map((s) => s.total)), 3);
    const band = plotW / slots.length;
    const barW = Math.max(1, Math.min(28, band * 0.7));
    const y = (v) => m.top + plotH - (v / max) * plotH;
    const chart = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    for (const tick of ticks) {
      svg('line', { class: 'grid', x1: m.left, x2: m.left + plotW, y1: y(tick), y2: y(tick) }, chart);
      text(chart, { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, String(tick));
    }
    svg('line', { class: 'baseline', x1: m.left, x2: m.left + plotW, y1: y(0), y2: y(0) }, chart);
    const cx = (i) => m.left + band * i + band / 2;
    const labelled = labelPoints(slots.length, plotW, 56);
    slots.forEach((s, i) => {
      const fresh = Math.min(s.total, s.fresh ?? 0);
      const returning = s.total - fresh;
      // The two parts have a 2px gap of the surface colour between them.
      const gap = fresh > 0 && returning > 0 ? 2 : 0;
      if (returning > 0) {
        const h = Math.max(1, y(0) - y(returning));
        svg('path', { class: fresh > 0 ? 'column column-flat' : 'column', d: columnPath(cx(i) - barW / 2, y(0) - h, barW, h) }, chart);
      }
      if (fresh > 0) {
        const top = y(s.total);
        const h = Math.max(1, y(returning) - top - gap);
        svg('path', { class: 'column column-new', d: columnPath(cx(i) - barW / 2, top, barW, h) }, chart);
      }
      if (labelled[i]) text(chart, { class: 'tick', x: cx(i), y: height - 8, 'text-anchor': 'middle' }, s.label);
    });
    const cross = svg('rect', { class: 'hover-band', y: m.top, height: plotH, width: band, visibility: 'hidden' }, chart);
    root.replaceChildren(chart);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', `Players by ${unit}. Use the arrow keys to read them.`);
    const tip = makeTooltip(root);
    scrub(
      root,
      slots.map((_, i) => cx(i)),
      (i) => {
        const s = slots[i];
        cross.setAttribute('x', String(cx(i) - band / 2));
        cross.setAttribute('visibility', 'visible');
        tip.show(cx(i), y(s.total), `${s.total} players`, `${s.fresh === null ? 'new players not known' : `${s.fresh} new`} · ${s.title ?? s.label}`);
      },
      () => {
        cross.setAttribute('visibility', 'hidden');
        tip.hide();
      },
    );
  };
  onResize(root, draw);
  return {
    update(next) {
      data = next;
      draw();
    },
  };
};

export { monthLabel };
