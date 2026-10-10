import { seasonChart } from './charts.js';
import { demoPlayers, demoProfile, demoSeason } from './demo.js';
import {
  clockHour,
  compact,
  countdown,
  countdownText,
  dayRange,
  formatDuration,
  formatHours,
  manyHours,
  metres,
  percent,
  plural,
  ROLE_AWARDS,
  SEASON_BOARDS,
  searchPlayers,
  shoutOuts,
  sideKey,
} from './format.js';
import { apiUrl, demo, showNotice, startLive, thisPage } from './live.js';
import { botUrl, configured as staffConfigured, loadToken } from './session.js';
import { openStory } from './story.js';
import {
  boardTable,
  el,
  link,
  longestHolder,
  mapBar,
  mapTag,
  matchHeadline,
  matchMeta,
  playerName,
  setText,
  sideName,
  teamColours,
  weaponsTable,
} from './views.js';
import { playerSeason, playerStory, seasonStory } from './wrapped.js';

// The season page: the roundup of a whole game season, from the bot's /api/season. The bot only sends it once the season
// is over; until then it sends when the season ends, and the page counts down to it. Staff signed in on the staff pages
// can see the season so far with ?preview, from the bot's staff API. ?demo shows a sample season, and ?demo=locked the
// page before it opens. Once it has the roundup, the page plays the Season in Review: the season as a slideshow, and a
// player's own season from their player page (see wrapped.js and story.js). ?player=<id> opens that player's.

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const preview = params.has('preview') && !demo;
const lockedDemo = params.get('demo') === 'locked';
const sharedPlayer = params.get('player');

// Days are UTC dates, like the bot's records; when the season ends and when a match ended, in the reader's own time.
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const whenLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: clockHour(), minute: '2-digit' });
const ended = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const ofDay = (day) => dayLong.format(Date.parse(`${day}T00:00:00Z`));

const matchCount = (n) => `${compact(n)} match${n === 1 ? '' : 'es'}`;
const people = (n) => `${compact(n)} player${n === 1 ? '' : 's'}`;

const message = (root, text) => root.replaceChildren(el('p', { className: 'muted board-empty', textContent: text }));

const tableOf = (table, headings, rows) => {
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...headings.map((h) => el('th', { scope: 'col', textContent: h })))),
    el('tbody', {}, ...rows.map((row) => el('tr', {}, ...row.map((cell) => el('td', { textContent: String(cell) }))))),
  );
};

const chart = seasonChart($('season-chart'));

// The countdown, every second while the page waits for the season to end.
let ticker = 0;
let endsAt = 0;

const tick = () => {
  const left = endsAt - Date.now();
  const parts = countdown(left);
  for (const unit of ['days', 'hours', 'minutes', 'seconds']) setText($(`cd-${unit}`), String(parts[unit]).padStart(unit === 'days' ? 1 : 2, '0'));
  setText($('countdown-label'), left > 0 ? `Opens in ${countdownText(left)}` : 'Opening now');
  // The page loads the bot's answer again every minute, so it opens by itself soon after.
  if (left <= 0) setText($('season-note'), 'The season is over. The roundup opens in a moment…');
};

const stopTicker = () => {
  clearInterval(ticker);
  ticker = 0;
};

// What staff see under the countdown: a link to the season so far, or why they can't see it.
const staffLine = (problem) => {
  const line = $('staff-preview');
  if (demo || !staffConfigured) {
    line.hidden = true;
    return;
  }
  if (problem === 'signin') {
    line.replaceChildren('Staff: ', link('admin', 'sign in on the staff page'), ' first, then come back to preview the roundup.');
  } else if (problem === 'failed') {
    line.replaceChildren('Staff: the preview could not be loaded just now. ', link(thisPage((p) => p.set('preview', '')), 'Try again'));
  } else if (loadToken()) {
    line.replaceChildren('Staff: ', link(thisPage((p) => p.set('preview', '')), 'see the season so far'), '. Only staff can see it until it opens.');
  } else {
    line.hidden = true;
    return;
  }
  line.hidden = false;
};

const showLocked = (page, problem) => {
  $('locked').hidden = false;
  $('roundup').hidden = true;
  endsAt = page.endsAt;
  setText($('season-eyebrow'), 'Opens at the wipe');
  setText($('season-lede'), `Who won. Who flopped. Who got roasted. ${page.name}, settled for good.`);
  setText($('season-note'), `Opens ${dateLong.format(page.endsAt)}`);
  setText($('locked-title'), `${page.name} ends at the wipe`);
  setText($('locked-text'), `${whenLong.format(page.endsAt)} (your time). Then it all drops here.`);
  staffLine(problem);
  if (ticker === 0) ticker = setInterval(() => !document.hidden && tick(), 1000);
  tick();
};

const renderHead = (page, r) => {
  setText($('season-eyebrow'), r.partial ? 'Staff preview' : 'The season is over');
  setText(
    $('season-lede'),
    r.partial
      ? `${page.name} so far on our server. The season ends with the wipe on ${dateLong.format(page.endsAt)}.`
      : `The best of ${page.name} on our server, from the first match our bot recorded up to the wipe.`,
  );
  setText($('season-note'), `${dayRange(r.start, r.end)}${r.partial ? ' so far' : ''} · ${plural(r.days.length, 'day')} (UTC days)`);
};

const renderNumbers = (r) => {
  setText($('numbers-note'), `${plural(r.days.length, 'day')} on our server.`);
  setText($('tile-matches'), compact(r.matches));
  setText($('tile-matches-sub'), r.matches > 0 ? `${manyHours(r.playedMs / 60_000)} of matches` : 'No matches went live');
  setText($('tile-players'), compact(r.players));
  setText($('tile-players-sub'), 'On the server at least once');
  setText($('tile-kills'), compact(r.totals.kills));
  setText($('tile-kills-sub'), `${compact(r.totals.deaths)} deaths, from the scoreboards`);
  setText($('tile-time'), manyHours(r.totals.minutes));
  setText($('tile-time-sub'), 'By everyone, seeding and live');
  setText($('tile-peak'), r.peakPlayers === null ? '–' : compact(r.peakPlayers));
  setText($('tile-peak-sub'), r.busiestDay ? `Busiest day ${ofDay(r.busiestDay.day)}: ${people(r.busiestDay.players)}` : '');
  setText($('tile-seed'), compact(r.totals.seedDays));
  setText($('tile-seed-sub'), `${manyHours(r.totals.seedingMinutes)} seeding`);

  setText($('chart-sub'), `Everyone on the server each UTC day.${r.partial ? ' The last day is not over: its dashed bar is so far.' : ''}`);
  chart.update({ days: r.days, partial: r.partial });
  const last = r.days.at(-1)?.day;
  tableOf(
    $('days-table'),
    ['Day (UTC)', 'Players', 'Matches', 'Peak', 'Time played'],
    r.days.map((d) => [
      `${ofDay(d.day)}${r.partial && d.day === last ? ' (so far)' : ''}`,
      d.players.toLocaleString('en-GB'),
      d.matches,
      d.peak ?? '–',
      formatHours(d.minutes),
    ]),
  );
};

const renderTeams = (r) => {
  const { colours, colourOf } = teamColours(r.teams);

  const best = r.bestTeam;
  const card = $('team-of-season');
  card.style.setProperty('--team', best ? colourOf(best.name) : 'var(--muted)');
  card.replaceChildren(
    el('p', { className: 'team-of-season-label', textContent: 'Team of the season' }),
    el('p', { className: 'team-of-season-name' }, best ? sideName(best.name, colours) : 'No clear winner'),
    el(
      'p',
      { className: 'team-of-season-detail' },
      best
        ? `Won ${best.wins} of ${matchCount(best.matches)}: ${percent(best.wins / best.matches)}, the best win rate of the season.`
        : `No team finished clearly ahead on win rate, from ${matchCount(r.teamMinMatches)}.`,
    ),
  );

  const standings = $('standings');
  if (r.teams.length === 0) {
    message(standings, 'No matches with a result this season.');
  } else {
    const most = Math.max(...r.teams.map((t) => t.wins), 1);
    standings.replaceChildren(
      el(
        'table',
        { className: 'players-table team-table' },
        el('thead', {}, el('tr', {}, ...['#', 'Team', 'Wins', 'Losses', 'Win rate'].map((h) => el('th', { scope: 'col', textContent: h })))),
        el(
          'tbody',
          {},
          ...r.teams.map((t, i) => {
            const bar = el('span', { className: t.wins > 0 ? 'team-bar' : 'team-bar team-bar-none', ariaHidden: 'true' });
            bar.style.setProperty('--share', String(t.wins / most));
            bar.style.setProperty('--team', colourOf(t.name));
            return el(
              'tr',
              {},
              el('td', { className: 'rank', textContent: String(i + 1) }),
              el('td', { className: 'player' }, sideName(t.name, colours), bar),
              el('td', { textContent: compact(t.wins) }),
              el('td', { textContent: compact(t.losses) }),
              el('td', { textContent: percent(t.matches > 0 ? t.wins / t.matches : null) }),
            );
          }),
        ),
      ),
    );
  }

  const swatch = (colour) => {
    const node = el('span', { className: 'team-swatch', ariaHidden: 'true' });
    node.style.setProperty('--team', colour);
    return node;
  };
  $('team-key').replaceChildren(...r.teams.map((t) => el('li', {}, swatch(colourOf(t.name)), t.name)));
  const list = $('map-wins');
  if (r.maps.length === 0) {
    list.replaceChildren(el('li', { className: 'muted', textContent: 'No matches with a result this season.' }));
  } else {
    list.replaceChildren(
      ...r.maps.map((m) => {
        const [top, next] = m.teams;
        const leads = top && top.wins > 0 && (!next || top.wins > next.wins);
        return el(
          'li',
          { className: 'map-wins-row' },
          el(
            'p',
            { className: 'match-headline' },
            mapTag(m.map),
            leads
              ? el('span', { className: 'match-score' }, sideName(top.name, colours), ' won most here')
              : el('span', { className: 'match-score muted', textContent: 'No team ahead' }),
          ),
          mapBar(m, r.teams, colourOf),
          matchMeta(matchCount(m.matches), `${formatDuration(m.averageMs)} on average`),
        );
      }),
    );
  }
  const winsOn = (m, name) => m.teams.find((t) => sideKey(t.name) === sideKey(name))?.wins ?? 0;
  tableOf(
    $('map-table'),
    ['Map', 'Matches', ...r.teams.map((t) => `${t.name} wins`), 'Average length'],
    r.maps.map((m) => [m.map, m.matches, ...r.teams.map((t) => winsOn(m, t.name)), formatDuration(m.averageMs)]),
  );

  const streak = $('streak');
  if (!r.streak) {
    message(streak, 'No matches with a result this season.');
  } else {
    const run = r.streak;
    const streakColours = new Map([...colours, ...teamColours([run]).colours]);
    streak.replaceChildren(
      el('p', { className: 'streak-wins' }, el('span', { className: 'streak-count', textContent: String(run.wins) }), ' in a row'),
      el('p', { className: 'match-headline' }, sideName(run.name, streakColours, 'side side-mine')),
      matchMeta(run.from === run.to ? `Ended ${ended.format(run.to)}` : `${ended.format(run.from)} to ${ended.format(run.to)}`),
    );
  }
};

const renderBoards = (r) => {
  $('boards').replaceChildren(
    ...SEASON_BOARDS.map((board) => {
      const rows = r[board.key] ?? [];
      return el(
        'article',
        { className: 'card board' },
        el('h3', { textContent: board.title }),
        board.sub ? el('p', { className: 'board-sub', textContent: board.sub(r) }) : null,
        rows.length > 0 ? boardTable(board, rows) : el('p', { className: 'muted board-empty', textContent: 'Nobody this season.' }),
      );
    }),
  );
};

// Each role's award: the winner, with the next two under them.
const roleCard = ({ role, top }) => {
  const award = ROLE_AWARDS[role] ?? { title: role, weapons: '' };
  const [winner, ...rest] = top;
  return el(
    'li',
    { className: 'card award' },
    el('p', { className: 'award-title', textContent: award.title }),
    el('p', { className: 'award-weapons', textContent: award.weapons }),
    winner
      ? el(
          'p',
          { className: 'award-winner' },
          el('span', { className: 'award-name' }, playerName(winner)),
          el('span', { className: 'award-count', textContent: plural(winner.kills, 'kill') }),
        )
      : el('p', { className: 'muted award-winner', textContent: 'Nobody this season.' }),
    rest.length > 0
      ? el(
          'ol',
          { className: 'award-runners', start: 2 },
          ...rest
            .slice(0, 2)
            .map((p) => el('li', {}, el('span', { className: 'award-runner-count', textContent: compact(p.kills) }), el('span', { className: 'player' }, playerName(p)))),
        )
      : null,
  );
};

const renderAwards = (r) => {
  const a = r.awards;
  const first = r.days[0]?.day;
  setText(
    $('awards-note'),
    a === null
      ? 'The role awards come from the game’s kill feed, which our bot did not have this season.'
      : `From the game’s kill feed${a.from > first ? `, since ${ofDay(a.from)}, when our bot started reading it` : ''}. Team kills don’t count.`,
  );
  $('roles').hidden = a === null;
  $('roles').replaceChildren(...(a?.roles ?? []).map(roleCard));
  const shouts = shoutOuts(r);
  $('shouts-title').hidden = shouts.length === 0;
  $('shouts').replaceChildren(
    ...shouts.map((s) =>
      el(
        'li',
        { className: 'card shout' },
        el('p', { className: 'award-title', textContent: s.title }),
        el('p', { className: 'shout-name' }, playerName(s.player)),
        el('p', { className: 'shout-detail', textContent: s.detail }),
        el('p', { className: 'award-weapons', textContent: s.why }),
      ),
    ),
  );
};

const renderWeapons = (r) => {
  const weapons = r.weapons;
  $('weapons').hidden = !weapons;
  if (!weapons) return;
  const first = r.days[0]?.day;
  setText(
    $('weapons-note'),
    `From the game’s kill feed${weapons.since > first ? `, since ${ofDay(weapons.since)}, when our bot started reading it` : ''}.`,
  );
  setText($('weapons-kills'), compact(weapons.kills));
  setText($('weapons-headshots'), percent(weapons.kills > 0 ? weapons.headshots / weapons.kills : null));
  setText($('weapons-headshots-sub'), weapons.kills > 0 ? `${compact(weapons.headshots)} of ${compact(weapons.kills)} kills` : '');
  const longest = weapons.longest;
  setText($('weapons-longest'), longest ? metres(longest.distance) : '–');
  $('weapons-longest-sub').replaceChildren(...(longest ? [longestHolder(longest), ` with the ${longest.weapon}`] : []));
  const root = $('weapons-list');
  if (weapons.top.length === 0) message(root, 'No kills recorded this season.');
  else root.replaceChildren(weaponsTable(weapons.top));
};

// The matches and days to remember: the biggest win, the closest finish, the quickest win, the longest match, the map
// played most and the busiest day. Each one only when the season had it.
const renderMoments = (r) => {
  const moment = (label, why, ...content) =>
    el('li', { className: 'card moment' }, el('p', { className: 'award-title', textContent: label }), el('p', { className: 'award-weapons', textContent: why }), ...content);
  const won = (m, ...meta) => [matchHeadline(m), matchMeta(`Ended ${ended.format(m.endedAt)}`, ...meta)];
  const moments = [
    r.biggestWin && moment('Biggest win', 'The win by the most points over the next team.', ...won(r.biggestWin)),
    r.closestMatch && moment('Closest finish', 'The win by the fewest points over the next team.', ...won(r.closestMatch)),
    r.quickestWin && moment('Quickest win', 'The shortest match a team won by reaching the winning score.', ...won(r.quickestWin, formatDuration(r.quickestWin.durationMs))),
    r.longestMatch && moment('Longest match', 'From going live to the end.', ...won(r.longestMatch, formatDuration(r.longestMatch.durationMs))),
    r.topMap && moment('Played most', 'The map with the most matches.', el('p', { className: 'match-headline' }, mapTag(r.topMap.map), el('span', { className: 'match-score', textContent: matchCount(r.topMap.matches) }))),
    r.busiestDay &&
      moment('Busiest day', 'The day with the most players on the server.', el('p', { className: 'match-headline' }, el('span', { className: 'match-score', textContent: ofDay(r.busiestDay.day) })), matchMeta(people(r.busiestDay.players))),
  ].filter(Boolean);
  $('moments').replaceChildren(...(moments.length > 0 ? moments : [el('li', { className: 'muted', textContent: 'No matches this season.' })]));
};

// The Season in Review. `current` is the page shown now, with its roundup.
let current = null;

// This page's address to share: the season's, or a player's own season.
const shareUrl = (id = null) =>
  new URL(
    thisPage((p) => {
      p.delete('preview');
      if (id) p.set('player', id);
      else p.delete('player');
    }),
    location.href,
  ).href;

// Shares with the phone's own sheet where there is one, or copies the link.
const shareButton = (url, title) => {
  const button = el('button', { type: 'button', className: 'btn story-share', textContent: 'Share' });
  button.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        button.textContent = 'Link copied';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') button.textContent = 'Couldn’t share';
    }
  });
  return button;
};

const storyButton = (text, action, className = 'btn btn-ghost') => {
  const button = el('button', { type: 'button', className, textContent: text });
  button.addEventListener('click', action);
  return button;
};

const playSeason = () => {
  if (!current) return;
  const title = `${current.name} in review`;
  openStory(seasonStory(current), {
    title,
    actions: (close) => [
      shareButton(shareUrl(), title),
      storyButton('Now do mine', () => {
        close();
        $('you-search').focus();
      }),
      storyButton('Every stat', close),
    ],
  });
};

// Everyone to find a name in, loaded the first time someone looks.
let directory = null;
const loadDirectory = async () => {
  if (directory) return directory;
  if (demo) return (directory = demoPlayers(Date.now()).players);
  const response = await fetch(apiUrl('players'), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  directory = (await response.json()).players;
  return directory;
};

const findYou = async () => {
  const query = $('you-search').value;
  const results = $('you-results');
  if (query.trim() === '') {
    results.replaceChildren();
    setText($('you-status'), '');
    return;
  }
  let players;
  try {
    players = await loadDirectory();
  } catch (error) {
    console.error('Could not load the players', error);
    setText($('you-status'), 'Couldn’t load the players just now. Try again in a minute.');
    return;
  }
  // The box may have changed while the players loaded.
  if ($('you-search').value !== query) return;
  const found = searchPlayers(players, query).slice(0, 6);
  setText($('you-status'), found.length === 0 ? `Nobody called “${query.trim()}” has played in the last 90 days.` : '');
  results.replaceChildren(
    ...found.map((p) => el('li', {}, storyButton(p.name, () => playYours(p.id), 'review-result'))),
  );
};

// A player's own season, from their player page. In ?demo the sample players' days run up to today, so their season is
// the last 15 days.
const playYours = async (id) => {
  if (!current) return;
  setText($('you-status'), 'Loading your season…');
  let profile = null;
  try {
    if (demo) profile = demoProfile(id, Date.now());
    else {
      const response = await fetch(apiUrl(`player?id=${encodeURIComponent(id)}`), { headers: { accept: 'application/json' } });
      if (response.ok) profile = await response.json();
      else if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Could not load the player', error);
    setText($('you-status'), 'Couldn’t load that player just now. Try again in a minute.');
    return;
  }
  if (!profile) {
    setText($('you-status'), 'There’s no player page for that player: nobody has it in the last 90 days, or it’s private.');
    return;
  }
  setText($('you-status'), '');
  const r = current.roundup;
  const [start, end] = demo ? [Date.now() - 15 * 86_400_000, Date.now()] : [r.start, r.end];
  const stats = playerSeason(profile, start, end);
  const title = `${profile.name}’s ${current.name}`;
  openStory(playerStory(stats, current, r.days.length), {
    title,
    actions: (close) => [
      shareButton(shareUrl(id), title),
      storyButton('The whole server’s', () => {
        close();
        playSeason();
      }),
      storyButton('Close', close),
    ],
  });
};

$('play-season').addEventListener('click', playSeason);
$('you-search').addEventListener('input', findYou);
$('you-search').addEventListener('focus', () => loadDirectory().catch(() => {}), { once: true });

const showRoundup = (page) => {
  stopTicker();
  current = page;
  $('locked').hidden = true;
  $('roundup').hidden = false;
  const r = page.roundup;
  renderHead(page, r);
  renderNumbers(r);
  renderTeams(r);
  renderBoards(r);
  renderAwards(r);
  renderWeapons(r);
  renderMoments(r);
  setText(
    $('review-text'),
    r.partial
      ? 'Staff preview: the season so far, one slide at a time, roasting included.'
      : `The best, the worst and the frankly embarrassing of ${page.name}, one slide at a time.`,
  );
  // A shared link to a player's own season opens it, once.
  if (sharedPlayer && !openedShared) {
    openedShared = true;
    playYours(sharedPlayer);
  }
  setText($('next-title'), r.partial ? `${page.name} so far` : `That’s ${page.name}`);
  setText(
    $('next-text'),
    r.partial
      ? `The season ends with the wipe on ${dateLong.format(page.endsAt)}, when everyone can see this page.`
      : `Thanks to everyone who played, seeded and squadded up in ${page.name}. The records start again now: see who leads the new season on the leaderboard.`,
  );
};

let openedShared = false;

// Only redraws when the bot's answer changes, so a refresh never closes an open table or moves the page.
let shown = null;
const render = (page, problem = null) => {
  const key = JSON.stringify([page, problem]);
  if (key === shown) return;
  shown = key;
  if (page === null) {
    setText($('season-note'), 'Waiting for the bot.');
    return;
  }
  if (page.roundup) showRoundup(page);
  else if (!page.open) showLocked(page, problem);
  else {
    stopTicker();
    $('locked').hidden = true;
    $('roundup').hidden = true;
    setText($('season-note'), `Our bot recorded nobody playing in ${page.name}.`);
  }
};

// The public page, kept fresh once a minute, so it opens by itself when the season ends.
const startPublic = (problem = null) =>
  startLive((page) => render(page, problem), {
    url: apiUrl('season'),
    sample: (now) => demoSeason(now, { locked: lockedDemo }),
    missing: () => setText($('season-note'), 'The season roundup is not ready yet. Check back soon.'),
  });

// The season so far, from the bot's staff API, for staff signed in on the staff pages. Without a sign-in, or when the
// bot refuses it, the public page shows with a line saying why.
const startPreview = async () => {
  const token = loadToken();
  if (!staffConfigured || !token) return startPublic('signin');
  try {
    const response = await fetch(botUrl('admin/season'), { headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
    if (!response.ok) return startPublic(response.status === 401 ? 'signin' : 'failed');
    const page = await response.json();
    render(page);
    showNotice(
      page.open ? 'The season is over, so this is what everyone sees. ' : `Staff preview: the season so far. Everyone can see it from ${dateLong.format(page.endsAt)}. `,
      link(thisPage((p) => p.delete('preview')), 'See the public page'),
    );
  } catch (error) {
    console.error('Could not load the season preview', error);
    startPublic('failed');
  }
};

if (preview) startPreview();
else startPublic();
