// Fixed inline SVG pictures for the seeding and account pages. Everything here is a constant written in this file; no
// text from the server or the bot ever goes into the markup. Names only choose which picture.

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

// How many of the 20 player dots are lit in each server state. A picture of the idea, not of the live count.
const LIT = { empty: 0, seeding: 6, live: 20 };

// A server rack of 4 rows of 5 player dots, filling up from empty to live.
export const serverArt = (kind) => {
  const lit = LIT[kind] ?? 0;
  const tone = kind === 'live' ? 'live' : kind === 'seeding' ? 'seeding' : 'empty';
  let dots = '';
  for (let i = 0; i < 20; i += 1) {
    const x = 36 + (i % 5) * 22;
    const y = 22 + Math.floor(i / 5) * 17;
    dots += `<circle class="art-dot${i < lit ? ' is-lit' : ''}" cx="${x}" cy="${y}" r="5.5"/>`;
  }
  return draw(
    `art-server art-server-${tone}`,
    '0 0 160 112',
    `<rect class="art-box" x="12" y="6" width="136" height="84" rx="10"/>${dots}` +
      `<path class="art-stand" d="M64 90v10M96 90v10M46 102h68"/>` +
      `<circle class="art-led" cx="136" cy="98" r="3"/>`,
  );
};

// A VIP ticket with a star and a torn edge.
export const vipTicketArt = () =>
  draw(
    'art-ticket',
    '0 0 96 56',
    '<path class="art-ticket-body" d="M6 6h84v14a8 8 0 0 0 0 16v14H6V36a8 8 0 0 0 0-16z"/>' +
      '<path class="art-ticket-cut" d="M66 9v38"/>' +
      '<path class="art-ticket-star" d="M34 15l4 8.2 9 1.3-6.5 6.3 1.5 9-8-4.3-8 4.3 1.5-9L21 24.5l9-1.3z"/>' +
      '<path class="art-ticket-line" d="M72 20h12M72 28h12M72 36h8"/>',
  );

// A door with a key beside it, for signing in.
export const signInArt = () =>
  draw(
    'art-door',
    '0 0 160 120',
    '<rect class="art-door-frame" x="38" y="10" width="62" height="100" rx="6"/>' +
      '<path class="art-door-leaf" d="M46 18h46v84H46z"/>' +
      '<circle class="art-door-knob" cx="82" cy="62" r="3.5"/>' +
      '<path class="art-door-glow" d="M92 18l22 10v66l-22 8z"/>' +
      '<g class="art-key"><circle cx="128" cy="86" r="9"/><circle class="art-key-hole" cx="128" cy="86" r="3"/><path d="M137 86h18M148 86v8M154 86v6"/></g>' +
      '<path class="art-sparkle" d="M120 30v10M115 35h10M140 50v6M137 53h6"/>',
  );

// Two chain links: joined when the Steam account is linked, apart with a break when it is not.
export const chainArt = (linked) =>
  draw(
    `art-chain ${linked ? 'is-linked' : 'is-unlinked'}`,
    '0 0 120 56',
    linked
      ? '<rect class="art-link" x="12" y="14" width="56" height="28" rx="14"/><rect class="art-link" x="52" y="14" width="56" height="28" rx="14"/>'
      : '<rect class="art-link" x="6" y="14" width="46" height="28" rx="14"/><rect class="art-link" x="68" y="14" width="46" height="28" rx="14"/>' +
          '<path class="art-spark" d="M56 10l3 8M64 46l-3-8M57 28h6"/>',
  );
