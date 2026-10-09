import { factionColours, kd, mapKey, mapSegments, metres, percent, result, sideColours, sideKey, WEAPON_KINDS } from './format.js';

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

// One leaderboard board's table, from BOARDS: its top players, ranked.
export const boardTable = (board, rows) =>
  el(
    'table',
    { className: 'players-table' },
    el(
      'thead',
      {},
      el('tr', {}, ...['#', 'Player', ...board.headings].map((h) => el('th', { scope: 'col', textContent: h }))),
    ),
    el(
      'tbody',
      {},
      ...rows.map((p, i) =>
        el(
          'tr',
          {},
          el('td', { className: 'rank', textContent: String(i + 1) }),
          el('td', { className: 'player' }, playerName(p)),
          ...board.cells(p).map((cell) => el('td', { textContent: cell })),
        ),
      ),
    ),
  );

// A side's name in its colour in game, when the server reported one.
export const sideName = (name, colours, className = 'side') => {
  const node = el('span', { className, textContent: name });
  const colour = colours.get(sideKey(name));
  if (colour) node.style.color = colour;
  return node;
};

// A finished match's map and every side's score, highest first, each name in its colour: "OZETI  Valkyra 100 · Lonestar
// 72 · Manticore 41". The winner is in bold. Teams never draw, so level at the top says "No result" (the bot missed who
// won, or the match was cut short). A side with no colour from the server gets its faction's usual one.
export const matchHeadline = (match) => {
  const outcome = result(match.factionScores);
  if (!outcome) return el('p', { className: 'match-headline' }, mapTag(match.map), el('span', { className: 'match-score', textContent: 'No score recorded' }));
  const colours = new Map([...factionColours, ...sideColours([match])]);
  const scores = [...match.factionScores].sort((a, b) => b.score - a.score);
  return el(
    'p',
    { className: 'match-headline' },
    mapTag(match.map),
    el(
      'span',
      { className: 'scores' },
      outcome.winner ? null : el('span', { className: 'muted', textContent: 'No result: ' }),
      ...scores.flatMap((s, i) => {
        const won = outcome.winner !== null && i === 0;
        return [
          i > 0 ? el('span', { className: 'muted', textContent: ' · ' }) : null,
          el(
            'span',
            { className: won ? 'score-side score-won' : 'score-side' },
            sideName(s.name, colours, won ? 'side side-mine' : 'side'),
            // Bold is the only sign of the winner on screen, so say it for screen readers too.
            won ? el('span', { className: 'visually-hidden', textContent: ' won' }) : null,
            ` ${s.score}`,
          ),
        ];
      }),
    ),
  );
};

export const matchMeta = (...parts) => el('p', { className: 'match-meta', textContent: parts.join(' · ') });

// Teams the game gave no colour to still need telling apart in the bars: the first three, by name, get these (checked
// together for colour-blind readers on the cards), any more the muted ink.
const FALLBACK = ['#3987e5', '#d95926', '#199e70'];
const NO_COLOUR = 'var(--muted)';

// Each team's colour in game, lightened to read on the cards, for its name (`colours`, for sideName) and its marks
// (`colourOf`, which has a colour for every team).
export const teamColours = (teams) => {
  const colours = sideColours([{ factionScores: teams }]);
  const missing = teams.map((t) => sideKey(t.name)).filter((key) => !colours.has(key)).sort();
  const fallback = new Map(missing.slice(0, FALLBACK.length).map((key, i) => [key, FALLBACK[i]]));
  return { colours, colourOf: (name) => colours.get(sideKey(name)) ?? fallback.get(sideKey(name)) ?? NO_COLOUR };
};

// A team's first letter, for a segment too narrow for its name.
const initial = (name) => Array.from(name)[0]?.toUpperCase() ?? '';

const winCount = (n) => `${n.toLocaleString('en-GB')} win${n === 1 ? '' : 's'}`;

// A map's matches as one bar, split by the team that won them, in the order of `teams` (the overall standings). Each
// part says whose it is as well as how many, so the colours are not the only way to tell the teams apart: the name when
// there is room, else the initial (the styles pick by the part's own width, and keep every part wide enough for its
// initial and count).
export const mapBar = (map, teams, colourOf) => {
  const bar = el('span', { className: 'map-bar', role: 'group', ariaLabel: `${map.map}: wins by team` });
  bar.append(
    ...mapSegments(map, teams).map((s) => {
      const label = `${s.name}: ${winCount(s.count)} (${percent(s.share)})`;
      const part = el(
        'span',
        { className: 'map-bar-part', role: 'img', ariaLabel: label, title: label },
        el(
          'span',
          { className: 'map-bar-label' },
          el('span', { className: 'map-bar-name', textContent: s.name }),
          el('span', { className: 'map-bar-initial', textContent: initial(s.name) }),
          el('span', { className: 'map-bar-count', textContent: String(s.count) }),
        ),
      );
      part.style.flexGrow = String(s.count);
      part.style.setProperty('--digits', String(String(s.count).length));
      part.style.setProperty('--team', colourOf(s.name));
      return part;
    }),
  );
  return bar;
};

// A weapon's name, with what it is when it is not carried by hand: "Humvee minigun  VEHICLE GUN".
const weaponName = (w) =>
  el('span', { className: 'weapon-name' }, w.name, WEAPON_KINDS[w.kind] ? el('span', { className: 'kind-tag', textContent: WEAPON_KINDS[w.kind] }) : null);

const weaponBar = (kills, most) => {
  const bar = el('span', { className: 'weapon-bar', ariaHidden: 'true' });
  bar.style.setProperty('--share', String(most > 0 ? kills / most : 0));
  return bar;
};

// Who made a longest kill, linking to their page when the bot sent their id.
export const longestHolder = (holder) => (holder.name ? playerName(holder) : 'a player');

// The bot's top weapons, most kills first: each with a bar for its kills against the first's, its share of headshots,
// average distance and longest kill.
export const weaponsTable = (top) => {
  const most = top[0]?.kills ?? 0;
  return el(
    'table',
    { className: 'players-table weapons-table' },
    el('thead', {}, el('tr', {}, ...['#', 'Weapon', 'Kills'].map((h) => el('th', { scope: 'col', textContent: h })))),
    el(
      'tbody',
      {},
      ...top.map((w, i) =>
        el(
          'tr',
          {},
          el('td', { className: 'rank', textContent: String(i + 1) }),
          el(
            'td',
            { className: 'weapon' },
            weaponName(w),
            weaponBar(w.kills, most),
            el(
              'p',
              { className: 'weapon-detail' },
              ...[
                el('span', { className: 'weapon-stat', textContent: `${percent(w.headshots / w.kills)} headshots` }),
                w.averageDistance === null ? null : el('span', { className: 'weapon-stat', textContent: `${metres(w.averageDistance)} on average` }),
                w.longest
                  ? el('span', {}, el('span', { className: 'weapon-stat', textContent: `longest ${metres(w.longest.distance)}` }), ' by ', longestHolder(w.longest))
                  : null,
              ]
                .filter(Boolean)
                .flatMap((part, i) => (i === 0 ? [part] : [' · ', part])),
            ),
          ),
          el('td', { textContent: w.kills.toLocaleString('en-GB') }),
        ),
      ),
    ),
  );
};
