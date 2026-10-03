import { kd, mapKey, result } from './format.js';

// DOM building blocks shared by the pages.

// Only touches the DOM when the text changes, so screen readers are not told the same thing every 15 seconds.
export const setText = (node, value) => {
  if (node.textContent !== value) node.textContent = value;
};

// Builds DOM with textContent only: player and server names come from the game and are never trusted as HTML.
export const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
};

export const link = (href, textContent) => el('a', { href, textContent });

// A player's page. Keeps ?demo and ?stats, so a preview stays a preview.
export const playerHref = (id) => {
  const url = new URL('player', location.href);
  const params = new URLSearchParams(location.search);
  for (const key of ['demo', 'stats']) if (params.has(key)) url.searchParams.set(key, params.get(key));
  url.searchParams.set('id', id);
  return url.pathname + url.search;
};

// A player's name, linking to their page when the bot sent their id. Older matches have names only.
export const playerName = (player) =>
  player.id ? el('a', { className: 'player-link', href: playerHref(player.id), textContent: player.name }) : player.name;

// A map's name as a tag in the map's own colour.
export const mapTag = (name) => {
  const tag = el('span', { className: 'map-tag', textContent: name || 'Unknown map' });
  const key = mapKey(name);
  if (key) tag.dataset.map = key;
  return tag;
};

export const playersTable = (top) =>
  el(
    'table',
    { className: 'players-table' },
    el(
      'thead',
      {},
      el('tr', {}, ...['#', 'Player', 'Kills', 'Deaths', 'K/D'].map((h) => el('th', { scope: 'col', textContent: h }))),
    ),
    el(
      'tbody',
      {},
      ...top.map((p, i) =>
        el(
          'tr',
          {},
          el('td', { className: 'rank', textContent: String(i + 1) }),
          el('td', { className: 'player' }, playerName(p)),
          el('td', { textContent: String(p.kills) }),
          el('td', { textContent: String(p.deaths) }),
          el('td', { textContent: kd(p.kills, p.deaths) }),
        ),
      ),
    ),
  );

// A finished match's map and result: "OZETI  Valkyra won 300–255".
export const matchHeadline = (match) =>
  el(
    'p',
    { className: 'match-headline' },
    mapTag(match.map),
    el('span', { className: 'match-score', textContent: result(match.factionScores)?.text ?? 'No score recorded' }),
  );

export const matchMeta = (...parts) => el('p', { className: 'match-meta', textContent: parts.join(' · ') });
