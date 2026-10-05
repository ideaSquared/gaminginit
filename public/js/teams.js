import { compact, formatDuration, mapSegments, percent, sideColours, sideKey } from './format.js';
import { startLive } from './live.js';
import { el, mapTag, matchMeta, setText, sideName } from './views.js';

// The teams page: which team wins most over the last 30 days, overall and on each map, from the bot's match records.

const $ = (id) => document.getElementById(id);

// When a match ended, in the reader's own time: "Fri 3 Oct".
const ended = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Teams the game gave no colour to still need telling apart in the bars: the first three, by name, get these (checked
// together for colour-blind readers on the cards), any more the muted ink. Draws are the quiet grey.
const FALLBACK = ['#3987e5', '#d95926', '#199e70'];
const NO_COLOUR = 'var(--muted)';
const DRAW_COLOUR = 'var(--series-quiet)';

// Each team's colour in game, lightened to read on the cards: for its name and its marks.
let colours = new Map();
let fallback = new Map();
const colourOf = (name) => colours.get(sideKey(name)) ?? fallback.get(sideKey(name)) ?? NO_COLOUR;

const setColours = (board) => {
  colours = sideColours([{ factionScores: board?.teams ?? [] }]);
  const missing = (board?.teams ?? []).map((t) => sideKey(t.name)).filter((key) => !colours.has(key)).sort();
  fallback = new Map(missing.slice(0, FALLBACK.length).map((key, i) => [key, FALLBACK[i]]));
};

const wins = (n) => `${compact(n)} win${n === 1 ? '' : 's'}`;
const matchCount = (n) => `${compact(n)} match${n === 1 ? '' : 'es'}`;

const message = (root, text) => root.replaceChildren(el('p', { className: 'muted', textContent: text }));

const renderTiles = (board) => {
  setText($('tile-matches'), board ? compact(board.matches) : '–');
  setText(
    $('tile-matches-sub'),
    board && board.matches > 0 ? `${board.draws} draw${board.draws === 1 ? '' : 's'} · ${formatDuration(board.averageMs)} on average` : '',
  );
  const [leader] = board?.teams ?? [];
  $('tile-leader').replaceChildren(leader && leader.wins > 0 ? sideName(leader.name, colours) : '–');
  setText($('tile-leader-sub'), leader && leader.wins > 0 ? `${wins(leader.wins)}, ${percent(leader.wins / leader.matches)} of their matches` : '');
  const streak = board?.streak ?? null;
  $('tile-streak').replaceChildren(streak ? sideName(streak.name, colours) : '–');
  setText($('tile-streak-sub'), streak ? `${wins(streak.wins)} in a row` : board && board.matches > 0 ? 'The latest match was a draw' : '');
};

// Each team, most wins first, with a bar for its wins against the leader's.
const renderStandings = (board) => {
  const root = $('standings');
  if (board.teams.length === 0) return message(root, 'No matches with a result in the last 30 days.');
  const most = Math.max(...board.teams.map((t) => t.wins), 1);
  // Every team plays every match, so "Played" is usually the same number all the way down. It only says something when
  // the teams played different numbers of matches.
  const played = new Set(board.teams.map((t) => t.matches)).size > 1;
  root.replaceChildren(
    el(
      'table',
      { className: 'players-table team-table' },
      el(
        'thead',
        {},
        el('tr', {}, ...['#', 'Team', 'Wins', 'Win rate', ...(played ? ['Played'] : [])].map((h) => el('th', { scope: 'col', textContent: h }))),
      ),
      el(
        'tbody',
        {},
        ...board.teams.map((t, i) => {
          const bar = el('span', { className: t.wins > 0 ? 'team-bar' : 'team-bar team-bar-none', ariaHidden: 'true' });
          bar.style.setProperty('--share', String(t.wins / most));
          bar.style.setProperty('--team', colourOf(t.name));
          return el(
            'tr',
            {},
            el('td', { className: 'rank', textContent: String(i + 1) }),
            el('td', { className: 'player' }, sideName(t.name, colours), bar),
            el('td', { textContent: compact(t.wins) }),
            el('td', { textContent: percent(t.matches > 0 ? t.wins / t.matches : null) }),
            played ? el('td', { textContent: compact(t.matches) }) : null,
          );
        }),
      ),
    ),
  );
};

// One swatch and name for each team, and one for draws, in the order the bars use.
const renderKey = (board) => {
  const swatch = (colour) => {
    const node = el('span', { className: 'team-swatch', ariaHidden: 'true' });
    node.style.setProperty('--team', colour);
    return node;
  };
  const draws = board.maps.some((m) => m.draws > 0);
  $('team-key').replaceChildren(
    ...board.teams.map((t) => el('li', {}, swatch(colourOf(t.name)), t.name)),
    ...(draws ? [el('li', {}, swatch(DRAW_COLOUR), 'Draw')] : []),
  );
};

// A team's first letter, for a segment too narrow for its name.
const initial = (name) => Array.from(name)[0]?.toUpperCase() ?? '';

// A map's matches as one bar, split by the team that won them. Each part says whose it is as well as how many, so the
// colours are not the only way to tell the teams apart: the name when there is room, else the initial (the styles pick
// by the part's own width), else only the count, which is on the part's label and title either way.
const mapBar = (map, board) => {
  const bar = el('span', { className: 'map-bar', role: 'group', ariaLabel: `${map.map}: wins by team` });
  bar.append(
    ...mapSegments(map, board.teams).map((s) => {
      const draw = s.name === null;
      const name = draw ? 'Draw' : s.name;
      const label = `${draw ? `Draws: ${matchCount(s.count)}` : `${name}: ${wins(s.count)}`} (${percent(s.share)})`;
      const part = el(
        'span',
        { className: draw ? 'map-bar-part map-bar-draw' : 'map-bar-part', role: 'img', ariaLabel: label, title: label },
        el(
          'span',
          { className: 'map-bar-label' },
          el('span', { className: 'map-bar-name', textContent: name }),
          el('span', { className: 'map-bar-initial', textContent: initial(name) }),
          el('span', { className: 'map-bar-count', textContent: String(s.count) }),
        ),
      );
      part.style.flexGrow = String(s.count);
      part.style.setProperty('--team', draw ? DRAW_COLOUR : colourOf(s.name));
      return part;
    }),
  );
  return bar;
};

const renderMaps = (board) => {
  const list = $('map-wins');
  if (board.maps.length === 0) {
    list.replaceChildren(el('li', { className: 'muted', textContent: 'No matches with a result in the last 30 days.' }));
    $('map-table').replaceChildren();
    return;
  }
  list.replaceChildren(
    ...board.maps.map((m) => {
      const [top, next] = m.teams;
      const leads = top && top.wins > 0 && (!next || top.wins > next.wins);
      return el(
        'li',
        { className: 'map-wins-row' },
        el(
          'p',
          { className: 'match-headline' },
          mapTag(m.map),
          leads ? el('span', { className: 'match-score' }, sideName(top.name, colours), ` wins most here`) : el('span', { className: 'match-score muted', textContent: 'No team ahead' }),
        ),
        mapBar(m, board),
        matchMeta(matchCount(m.matches), `${formatDuration(m.averageMs)} on average`, ...(m.draws > 0 ? [`${m.draws} draw${m.draws === 1 ? '' : 's'}`] : [])),
      );
    }),
  );
  const winsOn = (m, name) => m.teams.find((t) => sideKey(t.name) === sideKey(name))?.wins ?? 0;
  $('map-table').replaceChildren(
    el(
      'thead',
      {},
      el('tr', {}, ...['Map', 'Matches', ...board.teams.map((t) => `${t.name} wins`), 'Draws', 'Average length'].map((h) => el('th', { scope: 'col', textContent: h }))),
    ),
    el(
      'tbody',
      {},
      ...board.maps.map((m) =>
        el(
          'tr',
          {},
          ...[m.map, m.matches, ...board.teams.map((t) => winsOn(m, t.name)), m.draws, formatDuration(m.averageMs)].map((cell) =>
            el('td', { textContent: String(cell) }),
          ),
        ),
      ),
    ),
  );
};

// A won match: its map, who won and by how much, every team's score in its colour, and when it ended.
const renderFinish = (root, match) => {
  if (!match) return message(root, 'No wins in the last 30 days.');
  const scores = [...match.factionScores].sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  const margin = first.score - second.score;
  root.replaceChildren(
    el(
      'p',
      { className: 'match-headline' },
      mapTag(match.map),
      el('span', { className: 'match-score' }, sideName(first.name, colours), ` won by ${margin} point${margin === 1 ? '' : 's'}`),
    ),
    el(
      'p',
      { className: 'scores finish-scores' },
      ...scores.flatMap((s, i) => [i > 0 ? el('span', { className: 'muted', textContent: ' · ' }) : null, sideName(s.name, colours, i === 0 ? 'side side-mine' : 'side'), ` ${s.score}`]),
    ),
    matchMeta(`Ended ${ended.format(match.endedAt)}`, formatDuration(match.durationMs)),
  );
};

startLive((stats) => {
  const board = stats?.teams ?? null;
  setColours(board);
  renderTiles(board);
  for (const id of ['standings', 'closest', 'biggest']) {
    if (!board) message($(id), stats ? 'The teams appear once the bot sends them.' : 'Waiting for live stats.');
  }
  if (!board) {
    $('map-wins').replaceChildren(el('li', { className: 'muted', textContent: stats ? 'The teams appear once the bot sends them.' : 'Waiting for live stats.' }));
    return;
  }
  setText($('teams-note'), `Which team wins most, over the last ${board.days} days (UTC days).`);
  renderStandings(board);
  renderKey(board);
  renderMaps(board);
  renderFinish($('closest'), board.closest);
  renderFinish($('biggest'), board.biggest);
});
