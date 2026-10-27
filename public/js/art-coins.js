// Fixed inline SVG pictures for INITcoins: the coin, a stack of them, a progress ring, and an icon for each way to earn and thing
// to buy. Everything here is a constant written in this file; no text from the bot ever goes into the markup. Names only choose
// which picture. Colours come from the stylesheet (art-coins.css), so they follow the theme.

const NS = 'http://www.w3.org/2000/svg';

const draw = (className, viewBox, inner) => {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // Constant markup from this file only.
  svg.innerHTML = inner;
  return svg;
};

// One coin, face on: an edge, a face, a rim, the I of INIT, and a shine.
const COIN =
  '<circle class="c-edge" cx="50" cy="50" r="47"/>' +
  '<circle class="c-face" cx="50" cy="50" r="41"/>' +
  '<circle class="c-rim" cx="50" cy="50" r="34"/>' +
  '<path class="c-glyph" d="M41 32h18v7h-4.5v22H59v7H41v-7h4.5V39H41z"/>' +
  '<path class="c-shine" d="M22 40a30 30 0 0 1 20-19"/>';

export const coinArt = (className = 'coin-art') => draw(`coin ${className}`, '0 0 100 100', COIN);

// Three coins in a heap, for the hero.
export const coinHeap = () =>
  draw(
    'coin-heap',
    '0 0 240 230',
    `<g transform="translate(98 4) scale(1)"><g class="heap-back">${COIN}</g></g>` +
      `<g transform="translate(6 84) scale(1.1)"><g class="heap-left">${COIN}</g></g>` +
      `<g transform="translate(98 94) scale(1.3)"><g class="heap-front">${COIN}</g></g>` +
      '<path class="heap-spark" d="M24 26v14M17 33h14M222 70v10M217 75h10M200 20v8M196 24h8"/>',
  );

// A ring that fills to `percent` (0 to 100).
export const ring = (percent) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, percent));
  return draw(
    'ring',
    '0 0 100 100',
    `<circle class="ring-track" cx="50" cy="50" r="${r}"/>` +
      `<circle class="ring-fill" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - value / 100)).toFixed(2)}" transform="rotate(-90 50 50)"/>`,
  );
};

// A tick, for a finished mission.
export const tick = () => draw('tick', '0 0 24 24', '<path d="M5 12.5l4.5 4.5L19 7.5"/>');

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';

// 48 by 48 icons, in the colour of the text around them.
const ICONS = {
  // Seeding: a sprout.
  seed: `<g ${STROKE}><path d="M24 40V22"/><path d="M24 26c-9 0-14-5-14-13 9 0 14 5 14 13z"/><path d="M24 22c0-8 5-13 14-13 0 8-5 13-14 13z"/><path d="M14 40h20"/></g>`,
  // Seeding time: a stopwatch.
  time: `<g ${STROKE}><circle cx="24" cy="27" r="14"/><path d="M24 20v7l5 3"/><path d="M20 7h8M24 7v6"/></g>`,
  // Playing: a game pad.
  play: `<g ${STROKE}><path d="M12 16h24a7 7 0 0 1 7 7.5l-1.2 9a4.6 4.6 0 0 1-8 2.5L30 31H18l-3.8 4a4.6 4.6 0 0 1-8-2.5l-1.2-9A7 7 0 0 1 12 16z" transform="translate(0 1)"/><path d="M15 22v6M12 25h6"/><circle cx="31" cy="23" r="1.2"/><circle cx="35" cy="27" r="1.2"/></g>`,
  // A match played: a flag.
  match: `<g ${STROKE}><path d="M12 42V8"/><path d="M12 10h24l-5 8 5 8H12"/></g>`,
  // A match won: a trophy.
  win: `<g ${STROKE}><path d="M15 8h18v12a9 9 0 0 1-18 0z"/><path d="M15 12H8c0 6 3 9 7 10M33 12h7c0 6-3 9-7 10"/><path d="M24 29v8M16 41h16"/></g>`,
  // Missions: a target.
  mission: `<g ${STROKE}><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="1.5"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6"/></g>`,
  // Whitelist: a ticket.
  vip: `<g ${STROKE}><path d="M7 13h34v7a4 4 0 0 0 0 8v7H7v-7a4 4 0 0 0 0-8z"/><path d="M31 13v22" stroke-dasharray="3 3"/><path d="M19 19l1.8 3.6 4 .6-2.9 2.8.7 4L19 28l-3.6 1.9.7-4-2.9-2.8 4-.6z"/></g>`,
  // A title: a badge with a chevron.
  title: `<g ${STROKE}><path d="M24 5l15 5v12c0 10-6.5 16-15 20C15.5 38 9 32 9 22V10z"/><path d="M17 22l7-6 7 6M17 29l7-6 7 6"/></g>`,
  // A Discord role: a name tag.
  role: `<g ${STROKE}><rect x="6" y="12" width="36" height="24" rx="6"/><circle cx="16" cy="24" r="3.5"/><path d="M24 21h12M24 27h8"/></g>`,
  // Swapping a mission.
  swap: `<g ${STROKE}><path d="M10 18h26l-6-6M38 30H12l6 6"/></g>`,
};

export const icon = (name, className = 'icon-art') => draw(className, '0 0 48 48', ICONS[name] ?? ICONS.mission);
