import { mapKey } from './format.js';

// The pictures on the vote page (see vote.js): a scene for each map, and an icon for each time of day and weather. They are
// drawn here as fixed SVG, so nothing the bot sends is ever put in the markup: its text only picks which picture. A map
// or condition with no picture of its own gets the plain one.

const NS = 'http://www.w3.org/2000/svg';

const svg = (viewBox, body, className) => {
  const root = new DOMParser().parseFromString(
    `<svg xmlns="${NS}" viewBox="${viewBox}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">${body}</svg>`,
    'image/svg+xml',
  ).documentElement;
  root.setAttribute('class', className);
  return document.importNode(root, true);
};

const pines = (trees, base, fill) =>
  trees.map(([x, k]) => `<path d="M${x} ${base - 34 * k}L${x + 11 * k} ${base}H${x - 11 * k}z" fill="${fill}"/>`).join('');

// 240 x 120 scenes, one per map, each in the map's own colour.
const SCENES = {
  // Mountain village: snowy peaks, pines and a few cabin roofs under a warm sky.
  bakurani: `
    <defs><linearGradient id="vb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c2d12"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#vb-sky)"/>
    <circle cx="188" cy="38" r="15" fill="#fde68a" opacity=".9"/>
    <path d="M-10 92 62 28l30 36 28-22 70 56z" fill="#9a3412"/>
    <path d="M62 28 49 44l8-3 5 7 6-8 8 4z" fill="#fff7ed"/>
    <path d="M120 42 108 56l7-2 5 6 6-6 7 3z" fill="#fff7ed"/>
    <path d="M-10 120V84c40-16 90-8 130 2s80 4 130-10v44z" fill="#431407"/>
    ${pines([[22, 1.1], [44, 0.8], [172, 1], [198, 1.3], [222, 0.85]], 112, '#1c0a04')}
    <g fill="#1c0a04"><path d="M88 96l12-10 12 10v14H88z"/><path d="M122 100l9-8 9 8v10h-18z"/></g>
    <g fill="#fde68a"><rect x="98" y="99" width="4" height="5"/><rect x="129" y="101" width="3" height="4"/></g>`,
  // Coast: a lake or bay with a lighthouse, boats and low hills.
  ozeti: `
    <defs><linearGradient id="vo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#93c5fd"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#vo-sky)"/>
    <g fill="#fff" opacity=".85"><ellipse cx="50" cy="26" rx="22" ry="6"/><ellipse cx="66" cy="21" rx="14" ry="5"/><ellipse cx="170" cy="40" rx="20" ry="5"/></g>
    <path d="M-10 74c30-22 60-20 90-6s60 4 90-8 50-2 70 6v54H-10z" fill="#1e40af"/>
    <rect y="76" width="240" height="44" fill="#1d4ed8"/>
    <g stroke="#bfdbfe" stroke-width="1.6" stroke-linecap="round" opacity=".7" fill="none"><path d="M20 90h26M70 100h34M140 92h30M190 104h30M110 112h20"/></g>
    <g><path d="M186 78V42l8-4 8 4v36z" fill="#eff6ff"/><path d="M186 52h16M187 62h14" stroke="#dc2626" stroke-width="4"/><path d="M184 42h20l-10-9z" fill="#dc2626"/><rect x="190" y="44" width="8" height="5" fill="#fde047"/></g>
    <g><path d="M74 90h26l-5 8H80z" fill="#0f172a"/><path d="M87 90V68l11 20z" fill="#fff"/></g>`,
  // Industrial town: chimneys, a rail line and a hazy violet dusk.
  zestafona: `
    <defs><linearGradient id="vz-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b0764"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#vz-sky)"/>
    <circle cx="48" cy="46" r="17" fill="#fae8ff" opacity=".8"/>
    <path d="M-10 78 40 58l40 14 50-20 60 22 70-16v62H-10z" fill="#581c87"/>
    <g fill="#2e1065"><rect x="104" y="46" width="10" height="56"/><rect x="128" y="56" width="8" height="46"/><rect x="150" y="38" width="12" height="64"/><path d="M60 102V76h34v26zM168 102V82h40v20z"/><path d="M60 76l9-8h9l-9 8z"/></g>
    <g fill="#d8b4fe" opacity=".5"><ellipse cx="109" cy="38" rx="12" ry="6"/><ellipse cx="120" cy="28" rx="14" ry="6"/><ellipse cx="156" cy="30" rx="13" ry="6"/><ellipse cx="166" cy="19" rx="12" ry="5"/></g>
    <rect y="102" width="240" height="18" fill="#1e0836"/>
    <path d="M0 110h240" stroke="#a855f7" stroke-width="2" stroke-dasharray="8 6"/>
    <g fill="#fde68a"><rect x="68" y="86" width="4" height="4"/><rect x="80" y="86" width="4" height="4"/><rect x="178" y="90" width="4" height="4"/><rect x="194" y="90" width="4" height="4"/></g>`,
  // A map the page has no picture for: contour lines and a marker.
  plain: `
    <rect width="240" height="120" fill="#1a1e25"/>
    <g fill="none" stroke="#353c46" stroke-width="2"><path d="M-10 90c40-30 80 10 130-20s80 0 130-20"/><path d="M-10 108c40-30 80 10 130-20s80 0 130-20"/><path d="M-10 72c40-30 80 10 130-20s80 0 130-20"/></g>
    <path d="M120 24a16 16 0 0 0-16 16c0 14 16 30 16 30s16-16 16-30a16 16 0 0 0-16-16z" fill="#4fd6cc"/><circle cx="120" cy="40" r="6" fill="#04201e"/>`,
  // The Random button: a die.
  random: `
    <rect width="240" height="120" fill="#1a1e25"/>
    <g fill="none" stroke="#262b33" stroke-width="2"><circle cx="30" cy="30" r="22"/><circle cx="212" cy="96" r="30"/></g>
    <g transform="rotate(-10 120 60)"><rect x="86" y="26" width="68" height="68" rx="14" fill="#4fd6cc"/>
    <g fill="#04201e"><circle cx="105" cy="45" r="6"/><circle cx="135" cy="45" r="6"/><circle cx="120" cy="60" r="6"/><circle cx="105" cy="75" r="6"/><circle cx="135" cy="75" r="6"/></g></g>`,
  // Placeholder green scene until Sabatulo has its own: rolling hills under a clear sky.
  sabatulo: `
    <defs><linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14532d"/><stop offset="1" stop-color="#86efac"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#vs-sky)"/>
    <circle cx="190" cy="36" r="14" fill="#fef9c3" opacity=".9"/>
    <path d="M-10 84c40-26 80-22 120-6s90 4 130-14v56H-10z" fill="#166534"/>
    <path d="M-10 104c50-14 110-10 160 0s70 2 90-6v22H-10z" fill="#14532d"/>`,
};

// Which scene a map option shows: its colour name, "random", or the plain one.
export const sceneFor = (id, name) => {
  if (id === 'random') return 'random';
  const key = mapKey(name) ?? ['bakurani', 'ozeti', 'zestafona', 'sabatulo'].find((k) => String(id).toLowerCase().includes(k));
  return key ?? 'plain';
};

export const mapArt = (id, name) => svg('0 0 240 120', SCENES[sceneFor(id, name)], 'vote-art');

// 32 x 32 icons for the time of day and the weather. They draw in the text colour except for a touch of colour.
const sun = (cx, cy, r, fill = '#facc15') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const rays = (cx, cy, r1, r2) =>
  `<g stroke="#facc15" stroke-width="2" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return `<path d="M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}"/>`;
  }).join('')}</g>`;
const cloud = (fill = '#cbd5e1') => `<path d="M9 23a5 5 0 0 1 .8-9.9A7 7 0 0 1 23 12.5 5.3 5.3 0 0 1 23 23z" fill="${fill}"/>`;

const ICONS = {
  morning: `<path d="M3 24h26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 24a7 7 0 0 1 14 0z" fill="#fb923c"/>${rays(16, 24, 10, 13).replace('stroke-width="2"', 'stroke-width="2" opacity=".9"')}`,
  day: `${sun(16, 16, 6)}${rays(16, 16, 9, 13)}`,
  afternoon: `${sun(13, 12, 5)}${rays(13, 12, 7.5, 10.5)}${cloud()}`,
  dusk: `<path d="M3 24h26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 24a8 8 0 0 1 16 0z" fill="#e879f9"/><path d="M5 18h5M22 18h5M9 11l3 3M23 11l-3 3" stroke="#f0abfc" stroke-width="2" stroke-linecap="round"/>`,
  night: `<path d="M21 5a11 11 0 1 0 6 20A10 10 0 0 1 21 5z" fill="#c4b5fd"/><g fill="#fde68a"><circle cx="24" cy="8" r="1.4"/><circle cx="28" cy="14" r="1"/><circle cx="18" cy="6" r="1"/></g>`,
  clear: `${sun(16, 16, 6)}${rays(16, 16, 9, 13)}`,
  fog: `${cloud('#94a3b8')}<g stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"><path d="M5 26h16M10 29.5h17"/></g>`,
  rain: `${cloud('#94a3b8')}<g stroke="#60a5fa" stroke-width="2" stroke-linecap="round"><path d="M11 26l-1.5 4M17 26l-1.5 4M23 26l-1.5 4"/></g>`,
  snow: `${cloud('#94a3b8')}<g fill="#e0f2fe"><circle cx="11" cy="27" r="1.6"/><circle cx="17" cy="29" r="1.6"/><circle cx="23" cy="27" r="1.6"/></g>`,
  random: `<rect x="5" y="5" width="22" height="22" rx="6" fill="#4fd6cc"/><g fill="#04201e"><circle cx="11" cy="11" r="2"/><circle cx="21" cy="11" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="11" cy="21" r="2"/><circle cx="21" cy="21" r="2"/></g>`,
};

export const conditionIcon = (key) => svg('0 0 32 32', ICONS[key] ?? ICONS.random, 'vote-icon');
