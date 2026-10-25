import { crest } from './crests.js';
import { peekState } from './votemodel.js';

// The season roundup's and the vote page's illustrations. All fixed inline SVG written here: nothing the bot sends is ever put
// in the markup. A name or a role only picks which picture; the text beside it is always set with textContent elsewhere.

const NS = 'http://www.w3.org/2000/svg';

export const svg = (viewBox, body, className, slice = false) => {
  const root = new DOMParser().parseFromString(
    `<svg xmlns="${NS}" viewBox="${viewBox}" aria-hidden="true" focusable="false"${slice ? ' preserveAspectRatio="xMidYMid slice"' : ''}>${body}</svg>`,
    'image/svg+xml',
  ).documentElement;
  root.setAttribute('class', className);
  return document.importNode(root, true);
};

export const METAL = ['#fab219', '#cbd5e1', '#d08a4e'];

// A trophy cup, in gold (or another metal).
export const cup = (fill = METAL[0]) =>
  `<path d="M10 4h12v9a6 6 0 0 1-12 0z" fill="${fill}"/><path d="M10 7H5c0 5 2 8 6 8M22 7h5c0 5-2 8-6 8" fill="none" stroke="${fill}" stroke-width="2"/><path d="M14 19h4v4h-4z" fill="${fill}"/><path d="M9 28h14l-2-5H11z" fill="#8a5a0b"/><path d="M13 6v6" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`;

export const trophy = (className = 'art-trophy') => svg('0 0 32 32', cup(), className);

// A medal on a ribbon: rank 1 gold, 2 silver, 3 bronze.
const DIGITS = [
  '<path d="M14 19l2-2v8" fill="none" stroke="#3b2a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M13 19a3 3 0 1 1 5 2l-5 4h6" fill="none" stroke="#3b2a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M13 17.5h5l-3 3a3 3 0 1 1-2 5" fill="none" stroke="#3b2a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
];
export const medal = (rank) =>
  svg(
    '0 0 32 32',
    `<path d="M9 2h5l4 11h-5zM23 2h-5l-4 11h5z" fill="#4fd6cc" opacity=".85"/><circle cx="16" cy="21" r="9" fill="${METAL[rank - 1] ?? METAL[2]}"/><circle cx="16" cy="21" r="6.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>${DIGITS[rank - 1] ?? ''}`,
    'art-medal',
  );

const STAR = '<path d="M16 3l3.6 7.5 8.2 1.1-6 5.7 1.5 8.1L16 21.4l-7.3 4 1.5-8.1-6-5.7 8.2-1.1z" fill="currentColor"/>';

// A picture for each kill-feed role award.
const ROLE_ICONS = {
  assault: '<path d="M4 17h18l4-3h2v-3h-6l-3 2H4zM10 17v6h4v-6z" fill="currentColor"/>',
  support: '<path d="M6 25h14M9 25l6-12M13 12l10-5 2 4-10 5z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="7" r="2" fill="#fab219"/>',
  'machine-gun': '<path d="M3 15h20l3-2h3v4h-3l-3-1H3z" fill="currentColor"/><path d="M8 17l-3 8M12 17l3 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 12h6" stroke="#fab219" stroke-width="2.4" stroke-linecap="round"/>',
  marksman: '<circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="#d03b3b"/>',
  demolition: '<circle cx="14" cy="19" r="8" fill="currentColor"/><path d="M19 11l4-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M24 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fab219"/>',
  'vehicle-gun': '<path d="M4 22h24l-2-6H11l-2-4H5v4h4z" fill="currentColor"/><circle cx="9" cy="24" r="2.5" fill="#13161b" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="24" r="2.5" fill="#13161b" stroke="currentColor" stroke-width="1.6"/><circle cx="23" cy="24" r="2.5" fill="#13161b" stroke="currentColor" stroke-width="1.6"/><path d="M17 12h10" stroke="#fab219" stroke-width="2.6" stroke-linecap="round"/>',
};
const SHOUT_ICONS = {
  headhunter: '<circle cx="16" cy="17" r="9" fill="currentColor"/><circle cx="16" cy="17" r="3.5" fill="#13161b"/><path d="M16 2v6" stroke="#d03b3b" stroke-width="3" stroke-linecap="round"/>',
  'longest shot': '<path d="M3 25 29 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 5"/><circle cx="5" cy="24" r="3" fill="currentColor"/><circle cx="27" cy="8" r="4" fill="none" stroke="#fab219" stroke-width="2.2"/>',
  'jack of all trades': '<path d="M5 8h22M5 16h22M5 24h22" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="10" cy="8" r="2.5" fill="#fab219"/><circle cx="21" cy="16" r="2.5" fill="#fab219"/><circle cx="14" cy="24" r="2.5" fill="#fab219"/>',
  'road rage': '<path d="M4 21h24v-5l-4-5H10l-4 5z" fill="currentColor"/><circle cx="10" cy="22" r="3" fill="#13161b" stroke="currentColor" stroke-width="2"/><circle cx="22" cy="22" r="3" fill="#13161b" stroke="currentColor" stroke-width="2"/><path d="M28 6l-2 4M31 9l-4 1" stroke="#fab219" stroke-width="2" stroke-linecap="round"/>',
  bonk: '<path d="M8 26 22 9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M24 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fab219"/>',
  quickdraw: '<path d="M4 12h14l2 3h6v4h-8v6h-5v-6H4z" fill="currentColor"/><path d="M24 7l3-3M27 11h3" stroke="#fab219" stroke-width="2.2" stroke-linecap="round"/>',
  'ever-present': '<rect x="5" y="7" width="22" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5 13h22M11 4v6M21 4v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="m11 20 4 4 7-7" fill="none" stroke="#0ca30c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  'rookie of the season': STAR.replace('currentColor', '#fab219'),
};
const MOMENT_ICONS = {
  'biggest win': '<path d="M5 26V12M12 26V6M19 26V16M26 26V9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  'closest finish': '<path d="M4 16h24M4 10v12M28 10v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#fab219"/>',
  'quickest win': '<path d="M18 3 7 18h8l-2 11 12-16h-8z" fill="#fab219"/>',
  'longest match': '<circle cx="16" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 10v7l5 3M12 3h8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  'played most': '<path d="M3 8l8-3 10 3 8-3v19l-8 3-10-3-8 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M11 5v19M21 8v19" stroke="currentColor" stroke-width="1.6"/>',
  'busiest day': '<circle cx="11" cy="11" r="4" fill="currentColor"/><circle cx="22" cy="12" r="3.2" fill="currentColor" opacity=".7"/><path d="M3 27c0-6 4-9 8-9s8 3 8 9zM19 27c0-4 2-6 5-6s5 2 5 6z" fill="currentColor"/>',
};

const pick = (table, key) => table[String(key ?? '').trim().toLowerCase()] ?? STAR;
export const roleIcon = (role) => svg('0 0 32 32', ROLE_ICONS[role] ?? STAR, 'art-glyph');
export const shoutIcon = (title) => svg('0 0 32 32', pick(SHOUT_ICONS, title), 'art-glyph');
export const momentIcon = (label) => svg('0 0 32 32', pick(MOMENT_ICONS, label), 'art-glyph');

// The page banner: a wide dusk scene with a trophy, laurels and flags, cropped to fit any width.
export const banner = () => {
  const stars = Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 97 + 31) % 1200}" cy="${((i * 53 + 17) % 90) + 8}" r="${1 + (i % 3) * 0.6}" fill="#fff" opacity="${0.35 + (i % 4) * 0.12}"/>`).join('');
  const confetti = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 211 + 40) % 1200;
    const y = ((i * 71 + 20) % 140) + 10;
    const c = ['#fab219', '#4fd6cc', '#e879f9', '#60a5fa'][i % 4];
    return `<rect x="${x}" y="${y}" width="7" height="12" rx="1.5" fill="${c}" opacity=".75" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`;
  }).join('');
  const laurel = (flip) =>
    `<g transform="translate(600 100) scale(${flip ? -1 : 1} 1)"><path d="M-52 60C-90 40-98 0-70-34" fill="none" stroke="#4fd6cc" stroke-width="3" stroke-linecap="round" opacity=".8"/>${[0, 1, 2, 3, 4]
      .map((i) => `<path d="M${-86 + i * 4} ${40 - i * 17}c-14 0-20-8-20-16 12 0 20 6 20 16z" fill="#4fd6cc" opacity=".7"/>`)
      .join('')}</g>`;
  return svg(
    '0 0 1200 200',
    `<defs><linearGradient id="sb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset=".6" stop-color="#7c2d5a"/><stop offset="1" stop-color="#fb923c"/></linearGradient><radialGradient id="sb-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fde68a" stop-opacity=".7"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="200" fill="url(#sb-sky)"/>${stars}
    <circle cx="600" cy="100" r="95" fill="url(#sb-glow)"/>
    <path d="M0 160 150 100l120 50 140-70 160 80 140-60 150 60 130-50 210 50v40H0z" fill="#2a1030"/>
    <path d="M0 185c200-20 400-10 600-4s400 10 600-6v25H0z" fill="#13161b"/>
    ${confetti}${laurel(false)}${laurel(true)}
    <g transform="translate(560 40) scale(2.5)">${cup()}</g>
    <g stroke="#13161b" stroke-width="3"><path d="M200 190V120M1000 190V120"/></g>
    <path d="M200 120h46l-10 12 10 12h-46zM1000 120h-46l10 12-10 12h46z" fill="#4fd6cc"/>`,
    'season-banner-art',
    true,
  );
};

// The podium for the top three teams: crests on blocks, first in the middle. A name only picks the crest.
export const podium = (teams) => {
  const wrap = document.createElement('div');
  wrap.className = 'podium';
  wrap.setAttribute('aria-hidden', 'true');
  for (const i of [1, 0, 2].filter((n) => teams[n])) {
    const step = document.createElement('div');
    step.className = `podium-step podium-${i + 1}`;
    const top = crest(teams[i].name);
    top.classList.add('podium-crest');
    const block = document.createElement('div');
    block.className = 'podium-block';
    block.append(medal(i + 1));
    step.append(top, block);
    wrap.append(step);
  }
  return wrap;
};

const icon = (node, art) => {
  if (node.querySelector(':scope > [data-art]')) return;
  art.dataset.art = 'icon';
  node.prepend(art);
  node.classList.add('has-art');
};

// Adds the pictures to the roundup once season.js has drawn it. Safe to call after every redraw: the parts season.js
// replaces are drawn again and decorated again; the parts it keeps are decorated once.
export const decorateSeason = (r) => {
  const $ = (id) => document.getElementById(id);
  const head = document.querySelector('.season-head .wrap');
  if (head && !head.querySelector('.season-banner')) {
    const box = document.createElement('div');
    box.className = 'season-banner';
    box.setAttribute('aria-hidden', 'true');
    box.append(banner());
    head.querySelector('.back')?.after(box);
  }

  const tos = $('team-of-season');
  if (tos && r.bestTeam && !tos.querySelector('.tos-art')) {
    const wrap = document.createElement('div');
    wrap.className = 'tos-art';
    wrap.setAttribute('aria-hidden', 'true');
    const c = crest(r.bestTeam.name);
    c.classList.add('crest-big');
    wrap.append(c, trophy('tos-trophy'));
    tos.append(wrap);
  }

  const standings = $('standings');
  const rows = [...(standings?.querySelectorAll('tbody tr') ?? [])];
  if (standings && !standings.querySelector('.podium')) {
    rows.forEach((row, i) => {
      const t = r.teams[i];
      if (!t) return;
      row.querySelector('.player')?.prepend(crest(t.name));
      if (i < 3) {
        const rank = row.querySelector('.rank');
        rank.replaceChildren(medal(i + 1), Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: String(i + 1) }));
      }
    });
    if (r.teams.length >= 2 && rows.length > 0) standings.prepend(podium(r.teams.slice(0, 3)));
  }

  document.querySelectorAll('#team-key li').forEach((li, i) => {
    if (r.teams[i] && !li.querySelector('.crest')) li.prepend(crest(r.teams[i].name));
  });
  const streak = $('streak');
  if (streak && r.streak && !streak.querySelector('.crest')) {
    const c = crest(r.streak.name);
    c.classList.add('crest-lg');
    streak.querySelector('.streak-wins')?.append(c);
  }

  document.querySelectorAll('#roles > li').forEach((li, i) => {
    const entry = r.awards?.roles?.[i];
    icon(li, roleIcon(entry?.role));
    if (entry?.top?.[0] && !li.querySelector('.award-trophy')) li.append(trophy('award-trophy'));
  });
  document.querySelectorAll('#shouts > li').forEach((li) => icon(li, shoutIcon(li.querySelector('.award-title')?.textContent)));
  document.querySelectorAll('#moments > li.moment').forEach((li) => icon(li, momentIcon(li.querySelector('.award-title')?.textContent)));
  const first = document.querySelector('#boards > article h3');
  if (first && !first.querySelector('.art-medal')) first.prepend(medal(1));
  const next = document.querySelector('.season-next');
  if (next) icon(next, trophy('next-trophy'));
};

// The vote page: the hero panel's tint follows the time of day with the most votes.
const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];
export const heroTint = (vote) => {
  const hero = document.querySelector('.vote-hero');
  if (!hero) return;
  const items = vote?.conditions ?? [];
  const top = Math.max(0, ...items.map((c) => c.votes));
  const lead = items.filter((c) => top > 0 && c.votes === top && TIMES.includes(c.key));
  if (lead.length === 1) hero.dataset.time = lead[0].key;
  else delete hero.dataset.time;
};

// A short confetti burst over the winning map card when a vote has just closed. Once per vote id, and not at all when the
// reader prefers reduced motion.
const burst = new Set();
export const celebrate = (vote, now = Date.now()) => {
  const over = vote && !(vote.open && now < vote.closesAt) && vote.winner;
  if (!over || burst.has(vote.id) || (vote.closedAt != null && peekState(vote, now) !== 'won')) return;
  const card = document.querySelector('#vote-options [data-winner]');
  if (!card) return;
  burst.add(vote.id);
  const key = `vote-confetti-${vote.id}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Without storage it is once per page load.
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colours = ['#fab219', '#4fd6cc', '#e879f9', '#60a5fa', '#f87171', '#a3e635'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement('span');
    const a = (i / 36) * Math.PI * 2 + (i % 3) * 0.3;
    const d = 50 + ((i * 37) % 70);
    bit.style.cssText = `--dx:${(Math.cos(a) * d * 1.6).toFixed(0)}px;--dy:${(Math.sin(a) * d - 30).toFixed(0)}px;--r:${(i * 83) % 720}deg;--c:${colours[i % colours.length]};--delay:${(i % 6) * 30}ms`;
    layer.append(bit);
  }
  card.append(layer);
  setTimeout(() => layer.remove(), 2400);
};
