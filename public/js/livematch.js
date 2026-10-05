import {
  DEATH_TAGS,
  formatDuration,
  liveState,
  metres,
  multiKill,
  percent,
  shortAgo,
  sideColours,
  sideKey,
  STREAK_SHOWN,
  timeAgo,
  WEAPON_KINDS,
} from './format.js';
import { demoLive } from './demo.js';
import { apiUrl, startPush } from './live.js';
import { el, playerHref, playersTable, setText } from './views.js';

// The live page: the match on now, pushed by the bot as it happens. The kill feed, players, weapons and highlights
// come from the game's kill feed; the score, map and player count from the bot's check once a minute.

const $ = (id) => document.getElementById(id);

const LINK_STATES = {
  live: 'Live',
  connecting: 'Connecting',
  polling: 'Updating every 15 s',
  demo: 'Sample',
  off: 'Not connected',
};

// On phones the kill feed is a short list in the page, not a scroll box of its own (styles.css, below 900px): it shows
// this many kills at first, and this many more each time "Show more" is pressed.
const FEED_SHOWN = 15;
const narrow = window.matchMedia('(max-width: 899px)');

let snapshot = null;
// Deaths already shown, so the ones that arrive later stand out.
const shown = new Set();
// How many kills a phone shows now. It stays where "Show more" left it while the feed updates.
let feedShown = FEED_SHOWN;

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

// Each side's colour in game, lightened to read on the cards.
const colours = () => sideColours([{ factionScores: snapshot?.server?.factionScores ?? [] }]);

// A player's name in their side's colour, linking to their page when the bot sent their id.
const who = (ref, palette) => {
  const name = ref?.name || 'A player';
  const node = ref?.id ? el('a', { className: 'player-link who', href: playerHref(ref.id), textContent: name }) : el('span', { className: 'who', textContent: name });
  const colour = ref?.faction ? palette.get(sideKey(ref.faction)) : null;
  if (colour) node.style.color = colour;
  return node;
};

const sideName = (name, palette) => {
  const node = el('span', { className: 'side', textContent: name });
  const colour = palette.get(sideKey(name));
  if (colour) node.style.color = colour;
  return node;
};

// "Valkyra 43 – 32 Lonestar", each side in its colour; with three or more, "Valkyra 43 · Lonestar 32 · Manticore 20".
const scoreLine = (scores, palette) => {
  if (scores.length === 2) {
    const [a, b] = scores;
    return [sideName(a.name, palette), el('strong', { textContent: `${a.score} – ${b.score}` }), sideName(b.name, palette)];
  }
  return scores.flatMap((s, i) => [i > 0 ? el('span', { className: 'muted', textContent: '·' }) : null, sideName(s.name, palette), el('strong', { textContent: String(s.score) })]).filter(Boolean);
};

const tile = (label, value, ...sub) =>
  el('div', { className: 'tile' }, el('p', { className: 'tile-label', textContent: label }), el('p', { className: 'tile-value', textContent: value }), el('p', { className: 'tile-sub' }, ...sub));

const badge = (text, kind = '') => el('span', { className: `badge ${kind}`.trim(), textContent: text });

// One death in the kill feed: who killed whom with what, and what made it special.
const feedRow = (d, palette, now, fresh) => {
  const what = d.weapon
    ? el('span', { className: 'kill-weapon' }, d.weapon, WEAPON_KINDS[d.kind] ? el('span', { className: 'kind-tag', textContent: WEAPON_KINDS[d.kind] }) : null)
    : el('span', { className: 'kill-weapon kill-weapon-none', textContent: d.tags.includes('Falling') ? 'fell' : d.tags.includes('Suicide') ? 'suicide' : 'died' });
  const badges = [
    d.headshot ? badge('Headshot', 'badge-accent') : null,
    d.teamKill ? badge('Team kill', 'badge-bad') : null,
    multiKill(d.chain) ? badge(multiKill(d.chain), 'badge-hot') : null,
    !d.teamKill && d.streak >= STREAK_SHOWN ? badge(`${d.streak} in a row`, 'badge-hot') : null,
    ...d.tags.filter((t) => t !== 'Falling' && t !== 'Suicide').map((t) => (DEATH_TAGS[t] ? badge(DEATH_TAGS[t]) : null)),
    d.distance !== null && d.killer ? el('span', { className: 'kill-distance', textContent: metres(d.distance) }) : null,
  ].filter(Boolean);
  const time = el('span', { className: 'kill-time', textContent: shortAgo(now - d.at), title: new Date(d.at).toLocaleTimeString() });
  // Counts up between updates (renderMeta).
  time.dataset.at = String(d.at);
  return el(
    'li',
    { className: fresh ? 'kill kill-new' : 'kill' },
    time,
    el('div', { className: 'kill-body' }, el('p', { className: 'kill-line' }, ...(d.killer ? [who(d.killer, palette), ' '] : []), what, ' ', who(d.victim, palette)), badges.length > 0 ? el('p', { className: 'kill-badges' }, ...badges) : null),
  );
};

const renderFeed = (match, palette, now) => {
  const list = $('kill-feed');
  const more = $('more-kills');
  // Only the scroll box on wider screens needs the keyboard to reach it.
  if (narrow.matches) list.removeAttribute('tabindex');
  else list.tabIndex = 0;
  if (!match || match.feed.length === 0) {
    list.replaceChildren(el('li', { className: 'muted', textContent: 'Waiting for the first kill of this match.' }));
    more.hidden = true;
    return;
  }
  // The first update marks nothing as new, so the whole list does not flash.
  const firstLoad = shown.size === 0;
  // The newest kills come first, so a new one pushes the oldest shown off the end and the count stays put.
  const rows = narrow.matches ? match.feed.slice(0, feedShown) : match.feed;
  list.replaceChildren(...rows.map((d) => feedRow(d, palette, now, !firstLoad && !shown.has(d.id))));
  for (const d of match.feed) shown.add(d.id);
  if (shown.size > 500) shown.clear();
  more.hidden = rows.length >= match.feed.length;
  setText(more, `Show more (${match.feed.length - rows.length} left)`);
};

// The big value is text, or a player's name from who().
const highlight = (label, value, ...note) => [el('dt', { textContent: label }), el('dd', {}, el('strong', {}, value), el('span', { className: 'muted' }, ...note))];

const renderHighlights = (match, palette) => {
  const h = match.highlights;
  const entries = [
    h.firstBlood &&
      highlight('First blood', who(h.firstBlood.killer, palette), 'on ', who(h.firstBlood.victim, palette), h.firstBlood.weapon ? ` with the ${h.firstBlood.weapon}` : ''),
    h.onFire.length > 0 &&
      highlight(
        'On fire',
        plural(h.onFire[0].streak, 'kill'),
        ...h.onFire.flatMap((f, i) => [i > 0 ? ', ' : null, who(f.player, palette), i > 0 ? ` (${f.streak})` : '']).filter(Boolean),
        ' without dying',
      ),
    h.bestStreak && highlight('Best streak', plural(h.bestStreak.streak, 'kill'), who(h.bestStreak.player, palette)),
    h.bestMultiKill && highlight('Multi-kill', multiKill(h.bestMultiKill.kills), who(h.bestMultiKill.player, palette)),
    h.longest && highlight('Longest kill', metres(h.longest.distance), who(h.longest.player, palette), h.longest.weapon ? ` with the ${h.longest.weapon}` : ''),
    h.mostHeadshots && highlight('Most headshots', String(h.mostHeadshots.headshots), who(h.mostHeadshots.player, palette)),
    h.rivalry && highlight('Rivalry', `${h.rivalry.kills}×`, who(h.rivalry.killer, palette), ' keeps killing ', who(h.rivalry.victim, palette)),
  ].filter(Boolean);
  $('live-highlights').replaceChildren(...(entries.length > 0 ? entries.flat() : [el('dd', { className: 'muted', textContent: 'Highlights appear as the match goes on.' })]));
};

const renderWeapons = (match) => {
  const root = $('live-weapons');
  if (match.weapons.length === 0) {
    root.replaceChildren(el('p', { className: 'muted', textContent: 'No kills yet.' }));
    return;
  }
  const most = match.weapons[0].kills;
  root.replaceChildren(
    el(
      'table',
      { className: 'players-table stat-table' },
      el('thead', {}, el('tr', {}, ...['Weapon', 'Kills'].map((h) => el('th', { scope: 'col', textContent: h })))),
      el(
        'tbody',
        {},
        ...match.weapons.map((w) => {
          const bar = el('span', { className: 'weapon-bar', ariaHidden: 'true' });
          bar.style.setProperty('--share', String(w.kills / most));
          return el(
            'tr',
            {},
            el('td', {}, el('span', { className: 'weapon-name' }, w.name, WEAPON_KINDS[w.kind] ? el('span', { className: 'kind-tag', textContent: WEAPON_KINDS[w.kind] }) : null), bar),
            el('td', { textContent: String(w.kills) }),
          );
        }),
      ),
    ),
  );
};

const renderPlayers = (match, palette) => {
  const root = $('live-players');
  if (!match) {
    // Without the kill feed, the server's own scoreboard, read once a minute.
    const top = snapshot.currentMatch?.top ?? [];
    setText($('players-sub'), 'The top 5 by kills, from the server’s scoreboard, read once a minute.');
    root.replaceChildren(top.length > 0 ? playersTable(top) : el('p', { className: 'muted', textContent: 'No kills yet.' }));
    return;
  }
  setText($('players-sub'), 'Most kills first, from the kill feed. A streak is kills without dying.');
  root.replaceChildren(
    el(
      'table',
      { className: 'players-table live-players-table' },
      el('thead', {}, el('tr', {}, ...['#', 'Player', 'Kills', 'Deaths', 'Streak'].map((h) => el('th', { scope: 'col', textContent: h })))),
      el(
        'tbody',
        {},
        ...match.players.map((p, i) =>
          el(
            'tr',
            {},
            el('td', { className: 'rank', textContent: String(i + 1) }),
            el(
              'td',
              { className: 'player' },
              who(p, palette),
              el(
                'p',
                { className: 'weapon-detail' },
                [p.weapon, p.headshots > 0 ? plural(p.headshots, 'headshot') : null, p.bestStreak > 1 ? `best streak ${p.bestStreak}` : null, p.teamKills > 0 ? plural(p.teamKills, 'team kill') : null]
                  .filter(Boolean)
                  .join(' · '),
              ),
            ),
            el('td', { textContent: String(p.kills) }),
            el('td', { textContent: String(p.deaths) }),
            el('td', { className: p.streak >= STREAK_SHOWN ? 'hot' : '', textContent: String(p.streak) }),
          ),
        ),
      ),
    ),
  );
};

const renderMeta = (now) => {
  const server = snapshot?.server;
  const current = snapshot?.currentMatch;
  const match = snapshot?.match;
  setText(
    $('live-meta'),
    [
      server ? plural(server.players, 'player') : null,
      current?.liveAt ? `live for ${formatDuration(now - current.liveAt)}` : current ? `started ${timeAgo(now - current.startedAt)}` : null,
      match ? `last kill ${shortAgo(now - match.lastKillAt) === 'now' ? 'just now' : `${shortAgo(now - match.lastKillAt)} ago`}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  for (const node of document.querySelectorAll('.kill-time')) {
    const at = Number(node.dataset.at);
    if (at) setText(node, shortAgo(now - at));
  }
};

const IDLE = {
  offline: ['The server is not answering', 'Our bot cannot reach the game server right now. It may be restarting.'],
  empty: ['No match on right now', 'The server is empty. When players are on, the match shows here as it happens.'],
};

const render = (latest) => {
  snapshot = latest;
  const now = Date.now();
  const state = liveState(snapshot, now);
  const palette = colours();
  const server = snapshot?.server;
  setText($('live-title'), state === 'loading' ? 'Loading…' : server?.map || snapshot?.match?.map || 'Live match');
  $('live-score').replaceChildren(...(server && state !== 'offline' && server.factionScores.length > 0 ? scoreLine(server.factionScores, palette) : []));
  document.title = server?.map && state !== 'offline' ? `Live: ${server.map} | gaminginit WARDOGS server` : 'Live match | gaminginit WARDOGS server';

  const idle = IDLE[state];
  $('live-idle').hidden = !idle;
  if (idle) {
    setText($('idle-title'), idle[0]);
    setText($('idle-text'), idle[1]);
  }
  $('live-body').hidden = !!idle || state === 'loading';
  renderMeta(now);
  if (idle || state === 'loading') return;

  const match = snapshot.match;
  const withFeed = state === 'match' || state === 'waiting';
  $('live-tiles').hidden = !match;
  for (const id of ['highlights-panel', 'live-weapons-panel']) $(id).hidden = !match;
  $('kill-feed').closest('article').hidden = !withFeed;
  if (match) {
    const h = match.highlights;
    $('live-tiles').replaceChildren(
      tile('Kills', String(match.kills), `${percent(match.kills > 0 ? match.headshots / match.kills : null)} headshots`),
      tile('Longest kill', h.longest ? metres(h.longest.distance) : '–', ...(h.longest ? [who(h.longest.player, palette)] : [])),
      tile('Best streak', h.bestStreak ? String(h.bestStreak.streak) : '–', ...(h.bestStreak ? [who(h.bestStreak.player, palette)] : ['3 kills without dying'])),
      tile('Team kills', String(match.teamKills), match.otherDeaths > 0 ? `${plural(match.otherDeaths, 'other death')}` : ''),
    );
    renderHighlights(match, palette);
    renderWeapons(match);
  }
  if (withFeed) renderFeed(match, palette, now);
  renderPlayers(match, palette);
};

const showLink = (state) => {
  $('live-link').dataset.state = state;
  setText($('live-link-text'), LINK_STATES[state] ?? '');
};

// A bot without the live match answers 404.
const missing = () => {
  $('live-body').hidden = true;
  $('live-idle').hidden = false;
  setText($('live-title'), 'Live match');
  setText($('idle-title'), 'The live match is not on yet');
  setText($('idle-text'), 'Our bot does not follow the live match yet. Until it does, the server card shows the score and players.');
};

$('more-kills').addEventListener('click', () => {
  feedShown += FEED_SHOWN;
  if (snapshot?.match) renderFeed(snapshot.match, colours(), Date.now());
});

// Turning a phone sideways, or resizing the window, changes whether the feed is a short list or a scroll box.
narrow.addEventListener('change', () => {
  if (snapshot) render(snapshot);
});

startPush(render, { url: apiUrl('live'), socket: 'live/socket', sample: demoLive, onState: showLink, missing });

setInterval(() => {
  if (!document.hidden && snapshot) renderMeta(Date.now());
}, 5_000);
