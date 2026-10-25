import { mapArt } from './voteart.js';

// The home page's pictures: the server card's map scene, and the illustrated empty and offline states. The hero banner is
// fixed SVG in index.html, styled by art-home.css from the hero's data-kind. All of it is drawn here, so nothing the bot sends
// is put in the markup: its text only picks which picture.

const NS = 'http://www.w3.org/2000/svg';

const svg = (viewBox, body, className) => {
  const root = new DOMParser().parseFromString(
    `<svg xmlns="${NS}" viewBox="${viewBox}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">${body}</svg>`,
    'image/svg+xml',
  ).documentElement;
  root.setAttribute('class', className);
  return document.importNode(root, true);
};

// 240 x 120 states for when there is no map to show. Same size as the map scenes.
const STATES = {
  // Nobody on: a quiet camp at dawn.
  empty: `
    <defs><linearGradient id="hs-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a3a"/><stop offset="1" stop-color="#f0a77a"/></linearGradient></defs>
    <rect width="240" height="120" fill="url(#hs-dawn)"/>
    <circle cx="120" cy="84" r="22" fill="#fde7b0" opacity=".85"/>
    <path d="M-10 86c30-18 60-14 90-4s60 6 90-4 50-6 70 2v48H-10z" fill="#25303d"/>
    <path d="M-10 102c40-12 80-6 130 0s80 4 130-6v30H-10z" fill="#141b24"/>
    <path d="M150 104l16-26 16 26z" fill="#3a4757"/><path d="M166 78v26" stroke="#141b24" stroke-width="2"/><path d="M158 104l8-10 8 10z" fill="#141b24"/>
    <g stroke="#6b7a8c" stroke-width="2" stroke-linecap="round"><path d="M60 106l6-12M72 106l-6-12"/></g>
    <g fill="#fff" opacity=".7"><circle cx="30" cy="18" r="1.4"/><circle cx="70" cy="30" r="1"/><circle cx="196" cy="16" r="1.4"/><circle cx="214" cy="34" r="1"/></g>`,
  // Waiting for the first reading: contour lines and a question mark.
  waiting: `
    <rect width="240" height="120" fill="#1a1e25"/>
    <g fill="none" stroke="#2c333d" stroke-width="2"><path d="M-10 90c40-30 80 10 130-20s80 0 130-20"/><path d="M-10 108c40-30 80 10 130-20s80 0 130-20"/></g>
    <circle cx="120" cy="52" r="26" fill="none" stroke="#4fd6cc" stroke-width="4" stroke-dasharray="10 8"/>
    <path d="M110 46a10 10 0 1 1 14 9c-3 2-4 4-4 8" fill="none" stroke="#4fd6cc" stroke-width="5" stroke-linecap="round"/><circle cx="120" cy="72" r="3" fill="#4fd6cc"/>`,
  // Not answering: a dark radio mast, a broken signal and a grey sky.
  offline: `
    <rect width="240" height="120" fill="#15181d"/>
    <path d="M-10 96c40-14 80-8 130-2s80 0 130-10v46H-10z" fill="#1d2127"/>
    <path d="M120 98 108 98 120 30 132 98z" fill="none" stroke="#5b6572" stroke-width="3" stroke-linejoin="round"/>
    <path d="M112 78h16M115 60h10" stroke="#5b6572" stroke-width="3"/>
    <circle cx="120" cy="28" r="5" fill="#3a414b"/>
    <g fill="none" stroke="#3a414b" stroke-width="3" stroke-linecap="round" stroke-dasharray="14 10"><path d="M96 24a30 30 0 0 1 0 8M144 24a30 30 0 0 0 0 8"/><path d="M84 18a44 44 0 0 1 0 20M156 18a44 44 0 0 0 0 20"/></g>
    <g stroke="#ef4444" stroke-width="4" stroke-linecap="round" opacity=".8"><path d="M170 22l16 16M186 22l-16 16"/></g>`,
};

let drawn = '';

// Fills the server card's picture box: the map's scene while the server is on, else a picture for the state it is in.
// The map's name only picks which scene; nothing of it is written into the markup.
export const renderServerArt = (box, kind, map) => {
  const key = `${kind}|${map ?? ''}`;
  if (key === drawn) return;
  drawn = key;
  const showMap = Boolean(map) && kind !== 'offline' && kind !== 'waiting';
  const picture = showMap ? mapArt(map, map) : svg('0 0 240 120', STATES[kind === 'offline' || kind === 'waiting' ? kind : 'empty'], 'state-art');
  picture.classList.add('server-art-svg');
  box.dataset.art = showMap ? 'map' : 'state';
  box.replaceChildren(picture);
};

// The hero banner is styled by the server's state.
export const setHeroKind = (hero, kind) => {
  hero.dataset.kind = kind;
};
