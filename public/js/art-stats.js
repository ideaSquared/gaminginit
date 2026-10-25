import { el } from './views.js';

// Illustrations for the player and stats pages. All are fixed inline SVG drawn here, so nothing the bot sends is ever
// put in the markup: names and labels only pick which picture. Every one is decoration (aria-hidden).

const NS = 'http://www.w3.org/2000/svg';

const svg = (viewBox, body, className) => {
  const root = new DOMParser().parseFromString(
    `<svg xmlns="${NS}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`,
    'image/svg+xml',
  ).documentElement;
  root.setAttribute('class', className);
  return document.importNode(root, true);
};

const MEDALS = {
  1: ['#fde68a', '#d97706', '#b45309'],
  2: ['#f1f5f9', '#94a3b8', '#64748b'],
  3: ['#fdba74', '#c2410c', '#9a3412'],
};

// Gives a picture a name that shows on hover (a <title> child) and is read out, so an icon never has to be guessed at. Without one it stays
// decoration (aria-hidden).
export const describe = (node, text) => {
  const title = node.ownerDocument.createElementNS(NS, 'title');
  title.textContent = text;
  node.prepend(title);
  node.removeAttribute('aria-hidden');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', text);
  return node;
};

// A medal for a place from 1 to 3: ribbon and disc. The number is written next to it in HTML.
const PLACES = { 1: '1st', 2: '2nd', 3: '3rd' };

export const medal = (place) => {
  const [light, mid, dark] = MEDALS[place] ?? MEDALS[3];
  const node = svg(
    '0 0 24 28',
    `<path d="M6 0h5l3 10H8zM18 0h-5l-3 10h6z" fill="${dark}"/><path d="M8 0h3l2.5 8h-3z" fill="${mid}"/>
     <circle cx="12" cy="18" r="9" fill="${mid}" stroke="${dark}" stroke-width="1.5"/><circle cx="12" cy="18" r="6.5" fill="${light}" opacity=".35"/>`,
    'medal',
  );
  return describe(node, `${PLACES[place] ?? 'Top 3'} place on the leaderboard`);
};

// The rank cell of a leaderboard row: a medal for 1st to 3rd, a plain chip for the rest. The number stays as text.
export const rankBadge = (place) => {
  const top = place >= 1 && place <= 3;
  return el(
    'span',
    { className: top ? `rank-badge rank-top rank-${place}` : 'rank-badge rank-chip' },
    top ? medal(place) : null,
    el('span', { className: 'rank-num', textContent: String(place) }),
  );
};

export const flame = () =>
  svg(
    '0 0 16 20',
    '<path d="M8 1c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" fill="#f97316"/><path d="M8 19a3 3 0 0 1-3-3c0-2 2-3 3-5 1 2 3 3 3 5a3 3 0 0 1-3 3z" fill="#fde047"/>',
    'flame',
  );

// Gives the rows of a board's table rank badges, and a flame beside the names whose id is in `fire` (players on a kill streak).
export const decorateRanks = (table, rows, fire = new Set()) => {
  table.querySelectorAll('tbody tr').forEach((tr, i) => {
    const cell = tr.querySelector('td.rank');
    if (!cell) return;
    cell.replaceChildren(rankBadge(i + 1));
    const row = rows?.[i];
    const name = tr.querySelector('td.player');
    if (name && row?.id && fire.has(row.id)) {
      name.append(' ', el('span', { className: 'fire-mark', title: 'On a kill streak' }, flame(), el('span', { className: 'visually-hidden', textContent: 'On a kill streak' })));
    }
  });
};

// A rank emblem for a player's best leaderboard place: a shield with chevrons, gold, silver, bronze or steel.
export const rankEmblem = (place) => {
  const tier = place >= 1 && place <= 3 ? place : 0;
  const [light, mid, dark] = tier ? MEDALS[tier] : ['#cbd5e1', '#475569', '#1e293b'];
  const chevrons = tier === 1 ? 3 : tier === 2 || tier === 3 ? 2 : 1;
  const marks = Array.from(
    { length: chevrons },
    (_, i) => `<path d="M10 ${13 + i * 4.5}l6-3.5 6 3.5" fill="none" stroke="${light}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ).join('');
  const node = svg('0 0 32 32', `<path d="M16 2 28 6v9c0 7.5-5 12.5-12 15C9 27.5 4 22.5 4 15V6z" fill="${dark}" stroke="${mid}" stroke-width="2"/>${marks}`, 'rank-emblem');
  const named = ['Rank: not in the top 3 on the leaderboard yet', 'Gold rank: 1st on the leaderboard', 'Silver rank: 2nd on the leaderboard', 'Bronze rank: 3rd on the leaderboard'];
  return describe(node, named[tier]);
};

const WEAPON_ICONS = {
  rifle: '<path d="M1 12h6l2-2h8l1 2h9v2h-8l-1 5h-3l1-5H9l-2 2H1z" fill="currentColor"/>',
  sniper: '<path d="M1 14h22l2-2h6v2h-3v1h-5v1H9l-2 2H1z" fill="currentColor"/><path d="M11 8h7v2h-7z" fill="currentColor"/>',
  pistol: '<path d="M6 9h18v4h-8v3l-1 6h-4l1-6V13H6z" fill="currentColor"/>',
  explosive: '<circle cx="15" cy="18" r="8" fill="currentColor"/><path d="M12 9h6v3h-6zM18 10l5-4M23 6l2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  melee: '<path d="M24 3l5 5-14 14-3-2zM11 20l3 3-4 4-3-3z" fill="currentColor"/>',
  vehicle: '<path d="M4 20l2-7h14l4 3h4v4z" fill="currentColor"/><circle cx="10" cy="22" r="3" fill="currentColor" stroke="#13161b" stroke-width="1"/><circle cx="23" cy="22" r="3" fill="currentColor" stroke="#13161b" stroke-width="1"/>',
  machine: '<path d="M1 13h5l2-2h10l1 2h5v2H20l-1 6h-3l1-6H8l-2 2H1zM24 11h7v2h-7z" fill="currentColor"/>',
  barbed: '<path d="M2 16c4-8 8 8 14 0s10 8 14 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8l4 4M24 20l4 4M18 8l-3 4" stroke="currentColor" stroke-width="2"/>',
};

const WEAPON_NAMES = {
  rifle: 'Rifle',
  sniper: 'Sniper or marksman rifle',
  pistol: 'Pistol',
  explosive: 'Explosive or launcher',
  melee: 'Melee weapon',
  vehicle: 'Vehicle or emplaced weapon',
  machine: 'Machine gun',
  barbed: 'Barbed wire or buildable',
};

// Which picture a weapon gets: from the kind the bot sent first, then from its name.
export const weaponClass = (name, kind) => {
  if (kind === 'vehicle' || kind === 'vehicle-weapon' || kind === 'emplacement') return 'vehicle';
  if (kind === 'buildable') return 'barbed';
  const n = String(name ?? '').toLowerCase();
  if (/grenade|frag|rpg|launcher|mine|c4|ied|mortar|molotov|explosive|satchel|panzer|at4|javelin|stinger|claymore/.test(n)) return 'explosive';
  if (/knife|machete|axe|bayonet|shovel|bat|hammer|fist|melee|crowbar|sword|spade/.test(n)) return 'melee';
  if (/svd|sniper|mosin|barrett|awm|m24|dragunov|kar98|marksman|m14|dmr|sks|bow/.test(n)) return 'sniper';
  if (/pkm|m249|saw|machine ?gun|rpk|minigun|m60|lmg/.test(n)) return 'machine';
  if (/pistol|revolver|makarov|glock|m9|m1911|deagle|colt|p226|mp443/.test(n)) return 'pistol';
  return 'rifle';
};

// Weapons with a picture of the gun itself in img/weapons, named by the weapon's name in lower case with dashes.
const WEAPON_PICTURES = new Set([
  '9k333-verba', 'a-91', 'ak74', 'amp-9', 'amr-50', 'bmr-308', 'bushmaster-m17s', 'compound-bow', 'deagle', 'fal', 'galil',
  'ggx-17', 'ggx-18', 'judge', 'kh-2002', 'm1911', 'm249-saw', 'm4', 'm500', 'maaws', 'mgl-40', 'mk22', 'mosin-nagant', 'mp43',
  'mp5', 'pkm', 'pp-19-vityaz', 'rpg-7', 'scout-rifle-td', 'sks', 'super-45', 'sv98', 'svd', 't-21',
]);

// The gun's own picture, or the drawing for its type when there is none.
export const weaponIcon = (name, kind) => {
  const slug = String(name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  if (kind === 'weapon' && WEAPON_PICTURES.has(slug)) {
    return el('img', { className: 'weapon-picture', src: `img/weapons/${slug}.webp`, alt: '', title: name, loading: 'lazy', decoding: 'async' });
  }
  const key = weaponClass(name, kind);
  const node = svg('0 0 32 28', WEAPON_ICONS[key], 'weapon-icon');
  node.dataset.kind = key;
  return describe(node, WEAPON_NAMES[key]);
};

// A target: rings and a bullseye, for headshots.
export const target = () =>
  describe(svg(
    '0 0 20 20',
    '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1.6" fill="#ef4444"/><path d="M10 0v4M10 16v4M0 10h4M16 10h4" stroke="currentColor" stroke-width="1.5"/>',
    'target-icon',
  ), 'Headshots: the share of this weapon\'s kills that were headshots');

const TILE_ICONS = {
  players:
    '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8z" fill="currentColor"/><circle cx="21" cy="9" r="2.5" fill="currentColor" opacity=".55"/><path d="M22 14c3 .5 5 3 5 7h-4c0-3-.5-5-1-7z" fill="currentColor" opacity=".55"/>',
  clock: '<circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M14 7v7l5 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  kills: '<circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 2v8M14 18v8M2 14h8M18 14h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="14" r="1.8" fill="currentColor"/>',
  trophy: '<path d="M8 4h12v7a6 6 0 0 1-12 0zM12 17h4v4h4v3H8v-3h4z" fill="currentColor"/><path d="M8 6H3c0 4 2 6 5 6M20 6h5c0 4-2 6-5 6" fill="none" stroke="currentColor" stroke-width="2"/>',
};

export const tileIcon = (key) => svg('0 0 28 28', TILE_ICONS[key] ?? TILE_ICONS.players, 'tile-icon');

// Which headline tile icon a label gets.
export const tileIconFor = (label) => {
  const l = String(label).toLowerCase();
  if (/kill|k\/d/.test(l)) return 'kills';
  if (/hour|time|stay|minute|live|length|fill/.test(l)) return 'clock';
  if (/match|win|season|map/.test(l)) return 'trophy';
  if (/player|regular|seed|peak/.test(l)) return 'players';
  return null;
};

// Icons on the headline tiles under `root`, once each, also for tiles the page draws later.
export const decorateTiles = (root = document) => {
  for (const tile of root.querySelectorAll('.tile:not([data-art])')) {
    const label = tile.querySelector('.tile-label');
    if (!label) continue;
    const key = tileIconFor(label.textContent);
    tile.dataset.art = key ?? 'none';
    if (!key) continue;
    tile.classList.add('tile-art');
    tile.prepend(tileIcon(key));
  }
};

// A little empty chart: axes, bars, a dotted line and a magnifier.
export const emptyChart = () =>
  svg(
    '0 0 120 64',
    '<path d="M8 6v50h106" fill="none" stroke="var(--axis)" stroke-width="2" stroke-linecap="round"/><g fill="var(--surface-2)" stroke="var(--axis)" stroke-width="1.5"><rect x="20" y="38" width="12" height="18" rx="2"/><rect x="40" y="28" width="12" height="28" rx="2"/><rect x="60" y="44" width="12" height="12" rx="2"/></g><path d="M16 30c14-14 26 6 44-8s30 4 44-6" fill="none" stroke="var(--series-quiet)" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/><circle cx="92" cy="38" r="9" fill="none" stroke="var(--accent)" stroke-width="2.5"/><path d="M98.5 45l9 9" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>',
    'empty-art',
  );

// An illustration above the text of every empty chart under `root`, once each.
export const decorateEmpty = (root = document) => {
  for (const empty of root.querySelectorAll('.chart-empty:not([data-art])')) {
    empty.dataset.art = '1';
    const text = el('span', {});
    text.append(...empty.childNodes);
    empty.replaceChildren(emptyChart(), text);
  }
};

// Keep tiles and empty charts decorated as the page redraws them.
export const watchArt = (root = document.body) => {
  const run = () => {
    decorateTiles(root);
    decorateEmpty(root);
  };
  run();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      run();
    });
  }).observe(root, { childList: true, subtree: true });
};
