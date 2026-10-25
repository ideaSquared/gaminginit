import { mapArt } from './voteart.js';
import { crest } from './crests.js';

// Illustrations for the live and matches pages. All fixed inline SVG: text from the bot only picks which picture.

const NS = 'http://www.w3.org/2000/svg';

const svg = (viewBox, body, className) => {
  const root = new DOMParser().parseFromString(`<svg xmlns="${NS}" viewBox="${viewBox}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">${body}</svg>`, 'image/svg+xml').documentElement;
  root.setAttribute('class', className);
  return document.importNode(root, true);
};

const SCENES = {
  // An empty battlefield at dawn: a sun on the horizon, craters, a fallen fence and a lone flag.
  empty: `
    <defs><linearGradient id="al-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset=".6" stop-color="#9a3412"/><stop offset="1" stop-color="#fbbf24"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#al-dawn)"/>
    <g fill="#fff" opacity=".7"><circle cx="30" cy="14" r="1"/><circle cx="82" cy="24" r="1"/><circle cx="196" cy="12" r="1.2"/><circle cx="150" cy="30" r=".8"/></g>
    <circle cx="120" cy="82" r="22" fill="#fde68a" opacity=".95"/>
    <path d="M-10 84c30-10 60-8 90-2s70 4 100-4 50-4 70 2v50H-10z" fill="#3b1d0e"/>
    <path d="M-10 100c40-8 90-6 130 0s80 4 130-4v30H-10z" fill="#1c0f07"/>
    <g fill="#0f0905"><ellipse cx="52" cy="108" rx="18" ry="4"/><ellipse cx="178" cy="112" rx="22" ry="4"/></g>
    <g stroke="#0f0905" stroke-width="2" stroke-linecap="round" fill="none"><path d="M88 100l30-4M96 94l-4 14M112 91l-3 10"/><path d="M196 96V68"/></g>
    <path d="M196 68l16 5-16 6z" fill="#fb923c"/>`,
  // A lone tent under a dark sky, with a broken signal: the server is not answering.
  offline: `
    <defs><linearGradient id="al-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#al-night)"/>
    <g fill="#fff" opacity=".6"><circle cx="24" cy="18" r="1"/><circle cx="70" cy="30" r="1.2"/><circle cx="170" cy="14" r="1"/><circle cx="214" cy="34" r="1"/><circle cx="130" cy="22" r=".8"/></g>
    <circle cx="206" cy="26" r="9" fill="#e2e8f0" opacity=".85"/><circle cx="210" cy="23" r="8" fill="#0f172a"/>
    <path d="M-10 96c40-10 90-8 130-2s80 2 130-6v38H-10z" fill="#111827"/>
    <path d="M64 100 96 62l32 38z" fill="#475569"/>
    <path d="M96 62l-10 38h10z" fill="#334155"/><path d="M96 62l10 38H96z" fill="#64748b"/>
    <path d="M92 100l4-16 4 16z" fill="#0b1020"/>
    <path d="M96 62V54" stroke="#94a3b8" stroke-width="2"/>
    <g fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"><path d="M154 48a22 22 0 0 1 22 0M148 40a32 32 0 0 1 34 0M160 56a12 12 0 0 1 10 0"/></g>
    <circle cx="165" cy="66" r="3" fill="#94a3b8"/>
    <path d="M150 34l30 38" stroke="#f87171" stroke-width="3.5" stroke-linecap="round"/>`,
  // The match list, empty: a map table with a lone marker.
  matches: `
    <defs><linearGradient id="al-table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#al-table)"/>
    <path d="M40 96 60 36h120l20 60z" fill="#334155"/><path d="M52 88 68 42h104l16 46z" fill="#1f2937" stroke="#475569" stroke-width="1.5"/>
    <path d="M70 52c20 6 30-4 46 2s34 0 50 6M64 72c24-4 40 6 60 0s30-4 48 2" fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="4 4"/>
    <path d="M120 58V32l16 6-16 6" fill="#fb923c" stroke="#fb923c" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="120" cy="60" r="3" fill="#fb923c"/>`,
};

// Empty and offline pictures for the live page, and the empty matches list.
export const sceneArt = (key) => svg('0 0 240 120', SCENES[key] ?? SCENES.empty, 'art-scene');

// The wide picture behind the live match's title, chosen by the map's name.
export const bannerArt = (name) => {
  const box = document.createElement('div');
  box.className = 'live-banner';
  box.setAttribute('aria-hidden', 'true');
  box.append(mapArt(null, name));
  return box;
};

export const thumbArt = (name) => {
  const box = document.createElement('span');
  box.className = 'match-thumb';
  box.setAttribute('aria-hidden', 'true');
  box.append(mapArt(null, name));
  return box;
};

export { crest };
