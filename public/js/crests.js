import { FACTION_HEX, sideKey } from './format.js';

// A crest for each of the game's three factions (Lonestar, Manticore, Valkyra), as fixed SVG, so nothing the bot sends is ever put in
// the markup: the team's name only picks which crest. A side with no crest of its own gets a plain shield. Each is drawn in the
// faction's own colour (FACTION_HEX), on a dark shield, so it reads on the site's dark cards.

const NS = 'http://www.w3.org/2000/svg';

const SHIELD = 'M16 2 28 6v9c0 7.5-5 12.5-12 15C9 27.5 4 22.5 4 15V6z';

const EMBLEMS = {
  // A five-pointed star.
  lonestar: '<path d="m16 7.5 2.4 5 5.5.8-4 3.9.9 5.5L16 20.1l-4.8 2.6.9-5.5-4-3.9 5.5-.8z" fill="currentColor"/>',
  // A scorpion-like tail curling over a lion's claws: a curl and a barb.
  manticore:
    '<path d="M10 23c0-5 2-8 6-8s5-2 4-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="m20 10 3.2-1.6L22 12z" fill="currentColor"/><path d="M12 23h8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  // Two wings.
  valkyra:
    '<path d="M16 22V10M15 11C12 9 9 10 7 13c2.5-.500 3.5 0 4.5 1.5C9.5 15 8.5 16.5 8 18.5c2-1.5 4-1.5 6 .5zM17 11c3-2 6-1 8 2-2.5-.5-3.5 0-4.5 1.5 2 .5 3 2 3.5 4-2-1.5-4-1.5-6 .5z" fill="currentColor" stroke="currentColor" stroke-width=".8" stroke-linejoin="round"/>',
};

const crestSource = (key, colour) =>
  `<svg xmlns="${NS}" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="color:${colour}"><path d="${SHIELD}" fill="#13161b" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>${EMBLEMS[key] ?? '<circle cx="16" cy="15" r="4" fill="currentColor"/>'}</svg>`;

// Whether a side has a crest of its own.
export const hasCrest = (name) => Object.hasOwn(EMBLEMS, sideKey(String(name ?? '')));

// A team's crest as an <svg class="crest"> element. It is decoration (the team's name is always written beside it); size it in CSS.
export const crest = (name) => {
  const key = sideKey(String(name ?? ''));
  const colour = Object.entries(FACTION_HEX).find(([faction]) => sideKey(faction) === key)?.[1] ?? '#8a94a3';
  const root = new DOMParser().parseFromString(crestSource(key, colour), 'image/svg+xml').documentElement;
  root.setAttribute('class', 'crest');
  const node = document.importNode(root, true);
  // The team's name on hover; the name is also written beside it, so this only repeats it for the picture.
  const label = hasCrest(name) ? `${Object.keys(FACTION_HEX).find((f) => sideKey(f) === key)} crest` : 'Team crest';
  const title = document.createElementNS(NS, 'title');
  title.textContent = label;
  node.prepend(title);
  node.removeAttribute('aria-hidden');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  return node;
};
