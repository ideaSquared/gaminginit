import { demoAdmin, demoCall, demoCommands, demoRotations, demoRotationsChange } from './demo.js';
import {
  accountAge,
  alertCount,
  DEATH_TAGS,
  filterPlayers,
  flagLabel,
  flagRule,
  formatHours,
  headshotShare,
  kd,
  metres,
  modActionCounts,
  modActionLabel,
  needsLook,
  PLAYER_SORTS,
  readSteamId,
  RISK_LABELS,
  sessionExpiry,
  sideColours,
  sideKey,
  signInResult,
  staffBy,
  staffNote,
  steamFlagLabel,
  steamFlagRule,
  steamLinkedText,
  steamWhy,
  teamCounts,
  timeAgo,
  utcDay,
  watchList,
  withVehicle,
} from './format.js';
import { demo, showNotice, thisPage } from './live.js';
import { createRotations } from './rotations.js';
import { createTools } from './tools.js';
import { el, link, mapTag, playerName } from './views.js';

// The staff page, in four tabs. Players: everyone in game now, to search and act on. Alerts: what the bot found by
// itself: risky Steam accounts, possible griefers from the kill feed (team kills and suicides) and the incidents behind
// them. Admin: the admin tools (every staff command), the bans on the server, the reserved slots and everything staff did
// through the bot. Rotations: the map rotations, the week and what is on the server (see rotations.js). Staff sign in with Discord through the bot; the bot checks they are staff and sends them back with a
// session token, which this page keeps for this browser and sends with each request. Staff link the Steam account they
// play on, so the bot never counts them as seeders: the page asks once each sign-in until they have. ?demo shows sample
// data without signing in.

// The bot named in this page's own settings, never one named in the address (?stats=): a link could otherwise send a
// signed-in staff member's session to another site. To try a local bot, edit the meta tag in a local copy.
const botBase = document.querySelector('meta[name="stats-url"]')?.content ?? '';
const configured = botBase !== '' && !botBase.includes('YOUR-SUBDOMAIN');
const botUrl = (path) => new URL(path, botBase).href;

const REFRESH_MS = 60_000;
const SESSION_KEY = 'gaminginit-staff-session';
// A session this close to running out is dropped, so a request never goes out with one that has.
const EXPIRY_MARGIN_MS = 60_000;

const $ = (id) => document.getElementById(id);

// Sets a status line only when its words change, so a refresh does not make a screen reader say them again.
const setStatus = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

// A row of filter buttons drawn in place of the last, keeping keyboard focus on the button for the same choice
// (`data-key`) when one of the old ones had it, without scrolling to it: a refresh redraws the row while staff may have
// scrolled away from it.
const replaceButtons = (row, buttons) => {
  const focused = row.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
  row.replaceChildren(...buttons);
  if (focused !== undefined) buttons.find((b) => b.dataset.key === focused)?.focus({ preventScroll: true });
};

// Storage can be off (a private window, blocked site data): then the sign-in lasts until the page is closed.
let memoryToken = null;
const saveToken = (token) => {
  memoryToken = token;
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    // Kept in memory only.
  }
};
const loadToken = () => {
  let token = memoryToken;
  try {
    token = localStorage.getItem(SESSION_KEY) ?? token;
  } catch {
    // Kept in memory only.
  }
  const expiresAt = token ? sessionExpiry(token) : null;
  return expiresAt !== null && expiresAt - EXPIRY_MARGIN_MS > Date.now() ? token : null;
};
const forgetToken = () => {
  memoryToken = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing kept.
  }
};

// The kinds of action staff hid from the moderation log (MOD_ACTIONS keys), kept for this browser when storage is on.
const MODLOG_HIDDEN_KEY = 'gaminginit-modlog-hidden';
const loadHidden = () => {
  try {
    const kept = JSON.parse(localStorage.getItem(MODLOG_HIDDEN_KEY) ?? '[]');
    return new Set(Array.isArray(kept) ? kept.filter((a) => typeof a === 'string') : []);
  } catch {
    return new Set();
  }
};
const saveHidden = (hidden) => {
  try {
    localStorage.setItem(MODLOG_HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    // Kept until the page is closed.
  }
};

let period = 7;
let data = null;
// The tab shown, which the address keeps after the # for all but the first.
const TABS = ['players', 'alerts', 'admin', 'rotations'];
const TAB_NAMES = { players: 'Players', alerts: 'Alerts', admin: 'Admin', rotations: 'Rotations' };
let tab = 'players';
// The server list's search, team (a sideKey, '' for every team, 'none' for no team), "worth a look" and order.
const filters = { query: '', team: '', watch: false, sort: 'team' };
// The moderation log's hidden kinds of action, such as team moves.
const modHidden = loadHidden();
// Who is in game now, by Steam ID, so a menu only offers what works on them.
let onlineIds = new Set();
// New data that came while a player's Act menu was open: it is drawn once the menu closes, so a refresh never closes a
// menu under staff's pointer.
let waiting = null;
// The player whose incidents are shown, by Steam ID; null for everyone.
let focus = null;
let timer = 0;
let lastLoad = 0;
// Bumped by each load and by signing out, so an answer that comes back after a newer load started, or after signing
// out, is dropped.
let generation = 0;

// In the reader's own time: "Fri 3 Oct, 21:40".
const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const signInHref = () => {
  const url = new URL(botUrl('/auth/login'));
  url.searchParams.set('return', location.origin + location.pathname + location.search);
  return url.href;
};

const signedOut = (message) => {
  generation += 1;
  clearTimeout(timer);
  document.body.classList.remove('refreshing');
  data = null;
  $('admin-body').hidden = true;
  $('admin-user').hidden = true;
  $('signin').hidden = false;
  $('signin-link').href = signInHref();
  $('signin-error').hidden = !message;
  $('signin-error').textContent = message ?? '';
  if ($('steam-dialog').open) $('steam-dialog').close();
  rotations.reset();
};

const signOut = () => {
  forgetToken();
  signedOut(null);
};

// A Steam ID, linking to its Steam profile.
const steamLink = (steamId) =>
  el('a', {
    className: 'steam-id',
    href: `https://steamcommunity.com/profiles/${steamId}`,
    rel: 'noopener noreferrer',
    target: '_blank',
    textContent: steamId,
  });

// A player's name, linking to their public page, with their Steam ID linking to their Steam profile.
const who = (player) => el('span', { className: 'staff-player' }, playerName(player), steamLink(player.steamId));

const badge = (text, kind = '') => el('span', { className: `badge${kind ? ` badge-${kind}` : ''}`, textContent: text });

const selectTab = (name, { focus = false } = {}) => {
  tab = TABS.includes(name) ? name : 'players';
  for (const t of TABS) {
    const on = t === tab;
    $(`tab-${t}`).setAttribute('aria-selected', String(on));
    $(`tab-${t}`).tabIndex = on ? 0 : -1;
    $(`panel-${t}`).hidden = !on;
  }
  if (focus) $(`tab-${tab}`).focus();
  const hash = tab === 'players' ? '' : `#${tab}`;
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  // Loaded when first opened, as only staff working on rotations need them.
  if (tab === 'rotations' && data) rotations.show();
};

// Opens an admin tool with the player picked, on the Admin tab, with a way back to where staff were. `key` null keeps
// the tool open now when it takes a player.
const act = (key, player) => {
  const from = tab;
  selectTab('admin');
  tools.use(key, player.steamId, player.name);
  const back = $('tools-back');
  back.hidden = from === 'admin';
  back.textContent = `← Back to ${TAB_NAMES[from]}`;
  back.onclick = () => {
    back.hidden = true;
    selectTab(from);
  };
  // The tool scrolls itself into view; the card's top, with the way back, goes there instead.
  $('tools-title').closest('article').scrollIntoView({ block: 'start' });
};

// A row's button that opens an admin tool with that player picked.
const actButton = (text, key, player) =>
  el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: text, onclick: () => act(key, player) });

// What staff can do to a player from a row. Warnings, kicks and team moves only work on someone in game.
const ACTIONS = [
  { key: 'player', label: 'Look up', note: 'Steam ID, Steam account, time played, bans and staff history', inGame: false },
  { key: 'warn', label: 'Warn', note: 'A private message in game', inGame: true },
  { key: 'kick', label: 'Kick', note: 'They see the reason, and can rejoin', inGame: true },
  { key: 'switchteam', label: 'Move to another team', note: 'They respawn on the new side', inGame: true },
  { key: 'ban', label: 'Ban', note: 'For a set time or for good', inGame: false },
];

const closeMenus = (except = null) => {
  for (const menu of document.querySelectorAll('.act-menu[open]')) if (menu !== except) menu.open = false;
};

// Puts an open menu's list by its button: below it, or above when there is more room there.
const placeMenu = (menu) => {
  const list = menu.querySelector('.act-list');
  const box = menu.querySelector('summary').getBoundingClientRect();
  const below = window.innerHeight - box.bottom;
  list.style.right = `${Math.max(8, window.innerWidth - box.right)}px`;
  if (below < 260 && box.top > below) {
    list.style.top = '';
    list.style.bottom = `${window.innerHeight - box.top + 4}px`;
  } else {
    list.style.bottom = '';
    list.style.top = `${box.bottom + 4}px`;
  }
};

// An "Act" menu for a player. It opens over the page, so a table that scrolls sideways never cuts it off.
const actMenu = (player) => {
  const inGame = onlineIds.has(player.steamId);
  const list = el(
    'div',
    { className: 'act-list' },
    ...ACTIONS.filter((a) => inGame || !a.inGame).map((a) =>
      el(
        'button',
        {
          type: 'button',
          className: 'act-item',
          onclick: () => {
            menu.open = false;
            act(a.key, player);
          },
        },
        el('span', { className: 'act-label', textContent: a.label }),
        el('span', { className: 'act-note', textContent: a.note }),
      ),
    ),
    inGame ? null : el('p', { className: 'act-note act-off', textContent: 'Not in game, so they can’t be warned, kicked or moved.' }),
  );
  const menu = el('details', { className: 'act-menu' }, el('summary', { className: 'btn btn-ghost btn-small', textContent: 'Act' }), list);
  menu.addEventListener('toggle', () => {
    if (!menu.open) {
      // Once every menu has closed: another may have opened as this one closed.
      if (waiting && !document.querySelector('.act-menu[open]')) {
        const next = waiting;
        waiting = null;
        render(next);
      }
      return;
    }
    closeMenus(menu);
    placeMenu(menu);
  });
  return menu;
};

// Menus close on a click elsewhere or Escape, and follow their button when the page or a table scrolls.
document.addEventListener('click', (event) => {
  if (!event.target.closest('.act-menu')) closeMenus();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = document.querySelector('.act-menu[open]');
  if (!open) return;
  open.open = false;
  open.querySelector('summary').focus();
});
const placeOpenMenus = () => {
  for (const menu of document.querySelectorAll('.act-menu[open]')) placeMenu(menu);
};
document.addEventListener('scroll', placeOpenMenus, { capture: true, passive: true });
window.addEventListener('resize', placeOpenMenus);

const FLAG_KIND = { teamKills: 'bad', sameTeammate: 'bad', vehicleSuicides: 'hot', suicides: 'hot' };

const table = (node, headers, rows, empty) => {
  if (rows.length === 0) {
    node.replaceChildren(el('tbody', {}, el('tr', {}, el('td', { className: 'muted', colSpan: headers.length, textContent: empty }))));
    return;
  }
  node.replaceChildren(
    // A header as [text, 'num'] lines up with numbers on the right.
    el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', { scope: 'col', textContent: [h].flat()[0], className: [h].flat()[1] ?? '' })))),
    el('tbody', {}, ...rows),
  );
};

const cell = (...children) => el('td', {}, ...children);

// Who did something, by name. Someone the bot has no name for yet links to their Discord profile, which opens in
// Discord with their name.
const staffCell = (entry, staff = {}) => {
  const text = staffBy(entry, staff);
  if (!/^\d{17,20}$/.test(entry.by) || staff[entry.by] || entry.byName) return cell(text);
  return cell(el('a', { href: `https://discord.com/users/${entry.by}`, rel: 'noopener noreferrer', target: '_blank', textContent: text }));
};
const number = (value) => el('td', { className: 'num', textContent: String(value) });

const renderGriefers = (overview) => {
  const marks = overview.flags;
  $('flag-rules').replaceChildren(
    ...Object.keys(marks).map((flag) => el('li', {}, badge(flagLabel(flag), FLAG_KIND[flag]), ` ${flagRule(flag, marks)}`)),
  );
  $('griefers-note').textContent = overview.feedSince
    ? 'Everyone who team killed, was team killed or killed themselves, most flagged days first. ' +
      'A flag is a reason to look, not proof: check the incidents and ask around first.'
    : 'The bot has not had the game’s kill feed yet, so there are no team kills or suicides to show. See the bot’s README, “Weapon stats”.';
  const rows = overview.players.map((p) =>
    el(
      'tr',
      { className: focus === p.steamId ? 'focused' : '' },
      el(
        'td',
        { className: 'player' },
        who(p),
        el(
          'span',
          { className: 'badges' },
          ...p.flags.map((flag) => badge(flagLabel(flag), FLAG_KIND[flag])),
          p.flaggedDays > 1 ? badge(`${p.flaggedDays} days flagged`) : null,
          p.banned ? badge('Banned', 'accent') : null,
        ),
      ),
      number(withVehicle(p.teamKills, p.vehicleTeamKills)),
      cell(p.mostKilledTeammate && p.mostKilledTeammate.kills > 1 ? `${p.mostKilledTeammate.name} ×${p.mostKilledTeammate.kills}` : '–'),
      number(p.teamKilled),
      number(withVehicle(p.suicides, p.vehicleSuicides)),
      el('td', { className: 'num', textContent: p.matches > 0 ? `${p.matches} · ${p.kills} kills` : '–' }),
      el('td', { className: 'num', textContent: p.minutes > 0 ? formatHours(p.minutes) : '–' }),
      el(
        'td',
        { className: 'row-actions' },
        p.teamKills + p.teamKilled + p.vehicleSuicides > 0
          ? el('button', {
              type: 'button',
              className: 'btn btn-ghost btn-small',
              textContent: focus === p.steamId ? 'Showing' : 'Incidents',
              onclick: () => {
                focus = p.steamId;
                render(data);
                $('incidents-title').scrollIntoView({ block: 'start' });
              },
            })
          : null,
        actMenu(p),
      ),
    ),
  );
  table(
    $('griefers'),
    [
      'Player',
      ['Team kills', 'num'],
      'Killed most',
      ['Killed by team', 'num'],
      ['Suicides', 'num'],
      ['Matches', 'num'],
      ['Played', 'num'],
      '',
    ],
    rows,
    'Nobody team killed or killed themselves in this period.',
  );
};

const swatch = (colour) => {
  const node = el('span', { className: 'team-swatch', ariaHidden: 'true' });
  if (colour) node.style.setProperty('--team', colour);
  return node;
};

const PHASES = { live: ['Live', 'accent'], seeding: ['Seeding', 'hot'], empty: ['Empty', ''] };

// The server at a glance: whether the bot can reach it, its map, phase, players and score.
const renderServer = (overview) => {
  const { server, online } = overview;
  const strip = $('server-strip');
  if (!server) {
    strip.replaceChildren(el('p', { className: 'muted', textContent: 'The bot has not reached the game server yet.' }));
    return;
  }
  const colours = sideColours([{ factionScores: server.factionScores }]);
  if (online === null) {
    strip.replaceChildren(
      badge('Not answering', 'bad'),
      el('strong', { textContent: server.name }),
      el('span', { className: 'muted', textContent: `The bot last reached it ${timeAgo(overview.generatedAt - server.seenAt)}. The list comes back with it.` }),
    );
    return;
  }
  const [label, kind] = PHASES[server.phase] ?? [server.phase, ''];
  strip.replaceChildren(
    badge(label, kind),
    el('strong', { className: 'server-name', textContent: server.name }),
    mapTag(online.map),
    el('span', { textContent: `${online.players.length} / ${server.maxPlayers} players` }),
    server.factionScores.length > 0
      ? el('span', { className: 'server-score' }, ...server.factionScores.flatMap((f, i) => [i > 0 ? ' · ' : '', swatch(colours.get(sideKey(f.name))), ` ${f.name} ${f.score}`]))
      : null,
    el('span', { className: 'muted server-seen', textContent: `Checked ${timeAgo(overview.generatedAt - online.at)}` }),
  );
};

const renderTeamFilter = (players, colours) => {
  const teams = teamCounts(players);
  // A team picked before that is no longer in game falls back to everyone.
  if (filters.team && !teams.some((t) => (t.name === null ? 'none' : sideKey(t.name)) === filters.team)) filters.team = '';
  const button = (value, text, count, colour) => {
    const b = el(
      'button',
      {
        type: 'button',
        ariaPressed: String(filters.team === value),
        onclick: () => {
          filters.team = value;
          renderPlayers(data);
        },
      },
      colour === undefined ? null : swatch(colour),
      `${text} `,
      el('span', { className: 'filter-count', textContent: String(count) }),
    );
    b.dataset.key = value;
    return b;
  };
  replaceButtons($('team-filter'), [
    button('', 'All', players.length),
    ...teams.map((t) => (t.name === null ? button('none', 'No team', t.count) : button(sideKey(t.name), t.name, t.count, colours.get(sideKey(t.name)) ?? null))),
  ]);
};

// Everyone in game, as staff searched, filtered and sorted it.
const renderPlayers = (overview) => {
  if (!overview) return;
  const online = overview.online;
  const players = online?.players ?? [];
  const today = utcDay(overview.generatedAt);
  const colours = sideColours([{ factionScores: overview.server?.factionScores ?? [] }]);
  renderTeamFilter(players, colours);
  const shown = filterPlayers(players, filters, today);
  const query = filters.query.trim();
  setStatus(
    $('players-count'),
    online === null ? '' : shown.length === players.length ? `${players.length} in game` : `Showing ${shown.length} of ${players.length} in game`,
  );
  // On a phone each cell says what it is, as the table's headings are hidden there.
  const labelled = (label, td) => {
    td.dataset.label = label;
    return td;
  };
  const rows = shown.map((p) => {
    const watch = watchList(p, today);
    return el(
      'tr',
      { className: needsLook(p, today) ? 'watch' : '' },
      el('td', { className: 'player' }, who(p)),
      labelled('Team', cell(...(p.faction === null ? ['–'] : [swatch(colours.get(sideKey(p.faction)) ?? null), ` ${p.faction}`]))),
      labelled('Kills / deaths', el('td', { className: 'num', textContent: p.kills === null ? '–' : `${p.kills} / ${p.deaths ?? 0}` })),
      labelled('Today', el('td', { className: 'num', textContent: p.minutesToday > 0 ? formatHours(p.minutesToday) : '–' })),
      watch.length === 0
        ? el('td', { className: 'no-watch' }, el('span', { className: 'muted', textContent: '–' }))
        : el(
            'td',
            {},
            el(
              'span',
              { className: 'badges' },
              ...watch.map((w) => {
                const b = badge(w.text, w.kind);
                if (w.title) b.title = w.title;
                return b;
              }),
            ),
          ),
      el('td', { className: 'row-actions' }, actMenu(p)),
    );
  });
  const node = $('server-players');
  if (online === null) {
    table(node, ['Player'], [], 'The server isn’t answering, so there is no list. It comes back with the server.');
    return;
  }
  if (rows.length === 0 && query !== '') {
    node.replaceChildren(
      el(
        'tbody',
        {},
        el(
          'tr',
          {},
          el(
            'td',
            { className: 'muted', colSpan: 6 },
            `Nobody in game matches “${query}”. `,
            el('button', {
              type: 'button',
              className: 'link-button',
              textContent: `Look up “${query}” in everyone the bot knows`,
              onclick: () => act('player', { steamId: query, name: query }),
            }),
          ),
        ),
      ),
    );
    return;
  }
  table(
    node,
    ['Player', 'Team', ['Kills / deaths', 'num'], ['Today', 'num'], 'Worth knowing', ''],
    rows,
    players.length === 0 ? 'Nobody is in game.' : 'Nobody in game matches. Try another team, or show everyone.',
  );
};

const renderIncidents = (overview) => {
  const shown = overview.incidents.filter((i) => focus === null || i.player.steamId === focus || i.victim?.steamId === focus);
  const focused = focus === null ? null : (overview.players.find((p) => p.steamId === focus) ?? null);
  $('incidents-all').hidden = focus === null;
  $('incidents-note').textContent =
    focused === null
      ? 'Newest first. Sides come from the bot’s check each minute, so a player who switched sides in the last minute can ' +
        'show wrongly. Other suicides are only counted.'
      : `Involving ${focused.name}, newest first.`;
  const rows = shown.map((i) =>
    el(
      'tr',
      {},
      el('td', { className: 'when', textContent: when.format(i.at) }),
      cell(i.kind === 'team-kill' ? badge('Team kill', 'bad') : badge('Vehicle suicide', 'hot')),
      el('td', { className: 'player' }, who(i.player)),
      el('td', { className: 'player' }, i.victim ? who(i.victim) : '–'),
      cell(
        i.weapon ?? 'Unknown',
        ...i.tags
          .filter((t) => DEATH_TAGS[t] && t !== 'Suicide')
          .map((t) => el('span', { className: 'kill-distance', textContent: ` · ${DEATH_TAGS[t]}` })),
      ),
      el('td', { className: 'num', textContent: i.distance === null ? '–' : metres(i.distance) }),
      cell(i.map ? mapTag(i.map) : '–'),
    ),
  );
  table(
    $('incidents'),
    ['When', 'What', 'Player', 'Teammate killed', 'With', ['Distance', 'num'], 'Map'],
    rows,
    focused === null ? 'No team kills or vehicle suicides in this period.' : `None involving ${focused.name} in this period.`,
  );
};

const RISK_KIND = { high: 'bad', medium: 'hot' };
const points = (count) => `${count} point${count === 1 ? '' : 's'}`;

const renderSteam = (overview) => {
  const steam = overview.steam;
  // An older bot sends nothing; a bot without a Steam key sends null.
  if (!steam) {
    $('steam-note').textContent =
      steam === undefined
        ? 'The bot does not check Steam accounts yet. Deploy the latest bot.'
        : 'Steam checks are off: the bot has no STEAM_API_KEY. See the bot’s README, “Risky Steam accounts”.';
    $('steam-rules').replaceChildren();
    $('steam-accounts').replaceChildren();
    return;
  }
  const now = overview.generatedAt;
  $('steam-note').textContent =
    `The bot has checked ${steam.checked} of the ${steam.players} players seen in this period or in game now: ` +
    `${steam.high} high risk (${points(steam.risk.high)} or more) and ${steam.medium} worth a look (${steam.risk.medium} or more), riskiest first. ` +
    // An older bot posts every high-risk account, and sends no alert mark.
    (steam.risk.alert === undefined ? '' : `Only accounts on ${points(steam.risk.alert)} or more are posted to the moderation log by themselves. `) +
    'A reason to look, not proof: a ban may be years old and from another game, and honest players have new and private accounts too.';
  $('steam-rules').replaceChildren(
    ...Object.entries(steam.flags).map(([flag, count]) =>
      el('li', {}, badge(steamFlagLabel(flag)), ` ${steamFlagRule(flag, steam.marks)}: ${points(count)}`),
    ),
  );
  const rows = steam.accounts.map((a) =>
    el(
      'tr',
      {},
      el(
        'td',
        { className: 'player' },
        who(a),
        el(
          'span',
          { className: 'badges' },
          badge(`${RISK_LABELS[a.risk] ?? a.risk} · ${points(a.score)}`, RISK_KIND[a.risk]),
          a.inGame ? badge('In game', 'accent') : null,
          a.banned ? badge('Banned', 'accent') : null,
        ),
      ),
      el('td', { className: 'reason' }, steamWhy(a, now).join(' · ') || '–', el('span', { className: 'badges' }, ...a.flags.map((f) => badge(steamFlagLabel(f))))),
      el('td', { className: 'when' }, accountAge(a, now), el('span', { className: 'muted checked', textContent: `Checked ${when.format(a.checkedAt)}` })),
      el('td', { className: 'num', textContent: a.matches > 0 ? `${a.matches} · ${kd(a.kills, a.deaths)} K/D` : '–' }),
      el('td', { className: 'num', textContent: headshotShare(a.feedKills, a.headshots) ?? '–' }),
      el('td', { className: 'num', textContent: a.minutes > 0 ? formatHours(a.minutes) : '–' }),
      el('td', { className: 'row-actions' }, actMenu(a)),
    ),
  );
  table(
    $('steam-accounts'),
    ['Player', 'Why', 'Account', ['Matches', 'num'], ['Headshots', 'num'], ['Played', 'num'], ''],
    rows,
    'No risky accounts among the players in this period.',
  );
};

// The moderation log, without the kinds of action staff hid. Each kind is a toggle: pressed is shown.
const renderModeration = (overview) => {
  const button = ({ action, count }) => {
    const b = el(
      'button',
      {
        type: 'button',
        ariaPressed: String(!modHidden.has(action)),
        onclick: () => {
          if (!modHidden.delete(action)) modHidden.add(action);
          saveHidden(modHidden);
          renderModeration(data);
        },
      },
      `${modActionLabel(action)} `,
      el('span', { className: 'filter-count', textContent: String(count) }),
    );
    b.dataset.key = action;
    return b;
  };
  replaceButtons($('modlog-filter'), modActionCounts(overview.moderation).map(button));
  const shown = overview.moderation.filter((e) => !modHidden.has(e.action));
  const all = overview.moderation.length;
  setStatus($('modlog-count'), shown.length === all ? '' : `Showing ${shown.length} of ${all}`);
  const rows = shown.map((e) =>
    el(
      'tr',
      {},
      el('td', { className: 'when', textContent: when.format(e.at) }),
      cell(badge(modActionLabel(e.action), e.action === 'ban' ? 'bad' : e.action === 'kick' ? 'hot' : '')),
      el('td', { className: 'player' }, who(e.player)),
      el('td', { className: 'reason', textContent: e.reason ?? '–' }),
      staffCell(e, overview.staff),
      cell(e.detail ?? ''),
    ),
  );
  table($('modlog'), ['When', 'What', 'Player', 'Reason', 'By', 'Details'], rows, all > 0 ? 'Nothing shown: pick what to show above.' : 'Nothing in this period.');
};

const renderBans = (overview) => {
  if (overview.bans === null) {
    $('bans-note').textContent = 'Couldn’t read the server’s ban list just now. Trying again in a minute.';
    $('bans').replaceChildren();
    return;
  }
  $('bans-note').textContent = 'Everyone banned on the server now, with the reason. Bans made outside the bot are permanent.';
  // A ban keeps only who made it by Discord user ID, so a name kept with their log entries stands in when the bot sends
  // none.
  const logged = new Map(overview.moderation.filter((e) => e.byName).map((e) => [e.by, e.byName]));
  const rows = overview.bans.map((b) =>
    el(
      'tr',
      {},
      el(
        'td',
        { className: 'player' },
        who(b.player),
        b.onServer ? null : el('span', { className: 'badges' }, badge('Waiting: banned when they next join', 'hot')),
      ),
      el('td', { className: 'reason', textContent: b.bot?.reason ?? b.reason ?? '–' }),
      b.bot ? staffCell({ by: b.bot.by, byName: logged.get(b.bot.by) }, overview.staff) : cell(b.bannedBy ?? 'Outside the bot'),
      el('td', { className: 'when', textContent: b.bot ? when.format(b.bot.at) : '–' }),
      el('td', { className: 'when', textContent: b.bot?.until ? when.format(b.bot.until) : 'Never' }),
      el('td', { className: 'row-actions' }, actButton('Unban', 'unban', b.player)),
    ),
  );
  table($('bans'), ['Player', 'Reason', 'Banned by', 'Since', 'Ends', ''], rows, 'Nobody is banned.');
};

const renderReserved = (overview) => {
  const reserved = overview.reserved;
  if (reserved === undefined) {
    $('reserved-note').textContent = 'The bot does not send the reserved list yet. Deploy the latest bot.';
    $('reserved').replaceChildren();
    return;
  }
  if (reserved === null) {
    $('reserved-note').textContent = 'Couldn’t read ServerSettings.ini just now. Trying again in a minute.';
    $('reserved').replaceChildren();
    return;
  }
  const count = reserved.players.length;
  // Staff spots: the bot keeps one for each staff member who linked their Steam account.
  const staffCount = reserved.players.filter((r) => r.staff).length;
  $('reserved-note').textContent = [
    `${count} ${count === 1 ? 'player is' : 'players are'} on the reserved list in ServerSettings.ini, so they skip the queue when the server is full.`,
    staffNote(staffCount, count),
    reserved.maxSlots === null ? '' : `MaxReservedSlots holds ${reserved.maxSlots} of the server’s slots back for them.`,
    'Changes take effect when the server next restarts.',
  ]
    .filter(Boolean)
    .join(' ');
  const rows = reserved.players.map((r) =>
    el(
      'tr',
      {},
      el('td', { className: 'player' }, who(r.player)),
      cell(r.staff ? badge('Staff spot', 'accent') : r.bot ? badge('From the bot', 'accent') : badge('Permanent')),
      el('td', { className: 'when', textContent: (r.staff ?? r.bot) ? when.format((r.staff ?? r.bot).since) : '–' }),
      el('td', { className: 'when', textContent: r.staff ? 'While staff' : r.bot ? when.format(r.bot.until) : 'Never' }),
      // A staff spot goes when their Steam account is unlinked, below.
      el('td', { className: 'row-actions' }, r.staff ? null : actButton('Remove VIP', 'vip:remove', r.player)),
    ),
  );
  table($('reserved'), ['Player', 'VIP', 'Since', 'Ends', ''], rows, 'Nobody is on the reserved list.');
};

// The signed-in staff member's linked Steam account, or null.
const myProfile = (overview) => overview?.staffProfiles?.find((p) => p.userId === overview.user?.id) ?? null;

const ghostButton = (text, onclick) => el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: text, onclick });

// Staff who linked their Steam account, so the bot never counts them as seeders. Anyone can unlink anyone, for staff
// who have left.
const STAFF_STEAM_NOTE = $('staff-steam-note').textContent;
const renderStaffSteam = (overview) => {
  const profiles = overview.staffProfiles;
  const mineButton = $('staff-steam-mine');
  mineButton.hidden = profiles === undefined;
  const note = profiles === undefined ? 'The bot does not keep staff Steam accounts yet. Deploy the latest bot.' : STAFF_STEAM_NOTE;
  setStatus($('staff-steam-note'), note);
  if (profiles === undefined) {
    $('staff-steam').replaceChildren();
    return;
  }
  mineButton.textContent = myProfile(overview) ? 'Change yours' : 'Link yours';
  const rows = profiles.map((p) => {
    const mine = p.userId === overview.user?.id;
    // The bot names an account it has never seen by its Steam ID.
    const account = p.player.name === p.player.steamId ? steamLink(p.player.steamId) : who(p.player);
    return el(
      'tr',
      {},
      cell(mine ? `${p.name} (you)` : p.name),
      el('td', { className: 'player' }, account, ...(p.seen ? [] : [' ', badge('Not seen in 90 days', 'hot')])),
      el('td', { className: 'when', textContent: when.format(p.linkedAt) }),
      el(
        'td',
        { className: 'row-actions' },
        ...(mine ? [ghostButton('Change', () => openSteam())] : []),
        ghostButton('Unlink', () => unlinkSteam(p, mine)),
      ),
    );
  });
  table($('staff-steam'), ['Staff', 'Steam account', 'Linked', ''], rows, 'Nobody has linked theirs yet.');
};

// Draws new data, or keeps it until an open Act menu closes.
const show = (overview) => {
  if (document.querySelector('.act-menu[open]')) waiting = overview;
  else render(overview);
};

const render = (overview) => {
  waiting = null;
  data = overview;
  $('signin').hidden = true;
  $('admin-body').hidden = false;
  const user = $('admin-user');
  user.hidden = false;
  const mine = myProfile(overview);
  const steamButton = el('button', {
    type: 'button',
    className: 'link-button',
    textContent: mine ? `Steam: ${mine.player.name}` : 'Link your Steam account',
    onclick: () => openSteam(),
  });
  if (mine) steamButton.setAttribute('aria-label', `Change your Steam account, linked to ${mine.player.name}`);
  user.replaceChildren(
    `Signed in as ${overview.user?.name ?? 'staff'}`,
    ...(overview.staffProfiles === undefined ? [] : [' · ', steamButton]),
    ...(demo ? [] : [' · ', el('button', { type: 'button', className: 'link-button', textContent: 'Sign out', onclick: signOut })]),
  );
  for (const button of document.querySelectorAll('.period button[data-days]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.days) === period));
  }
  const span = period === 1 ? 'Today' : `The last ${period} days`;
  $('period-note').textContent = overview.feedSince
    ? `${span} (UTC days). Team kills and suicides come from the kill feed, which the bot has had since ${overview.feedSince}.`
    : `${span} (UTC days).`;
  const players = overview.online?.players ?? [];
  const today = utcDay(overview.generatedAt);
  onlineIds = new Set(players.map((p) => p.steamId));
  $('count-players').textContent = overview.online ? String(players.length) : '–';
  const alerts = alertCount(overview);
  $('count-alerts').textContent = String(alerts);
  $('count-alerts').classList.toggle('tab-count-alert', alerts > 0);
  $('tile-ingame').textContent = overview.online ? String(players.length) : '–';
  $('tile-ingame-note').textContent = overview.server ? `of ${overview.server.maxPlayers} slots` : '';
  $('tile-watch').textContent = String(players.filter((p) => needsLook(p, today)).length);
  $('tile-risky-ingame').textContent = overview.steam ? String(players.filter((p) => p.steam && p.steam.risk !== 'low').length) : 'Off';
  $('tile-new').textContent = String(players.filter((p) => p.firstSeen === today).length);
  $('tile-risky').textContent = overview.steam ? String(overview.steam.high + overview.steam.medium) : 'Off';
  $('tile-risky-note').textContent = overview.steam ? `${overview.steam.high} high risk` : 'Needs STEAM_API_KEY';
  $('tile-flagged').textContent = String(overview.totals.flaggedPlayers);
  $('tile-teamkills').textContent = String(overview.totals.teamKills);
  $('tile-teamkills-note').textContent = overview.totals.vehicleTeamKills > 0 ? `${overview.totals.vehicleTeamKills} with a vehicle` : '';
  $('tile-vehicle').textContent = String(overview.totals.vehicleSuicides);
  $('tile-suicides-note').textContent = `${overview.totals.suicides} suicides of any kind`;
  renderServer(overview);
  renderPlayers(overview);
  renderGriefers(overview);
  renderIncidents(overview);
  renderSteam(overview);
  renderModeration(overview);
  renderBans(overview);
  renderReserved(overview);
  renderStaffSteam(overview);
  if (overview.staffProfiles !== undefined && !mine && !askedThisSignIn()) {
    noteAsked();
    openSteam();
  }
  if (!tools.ready) loadCommands();
  if (tab === 'rotations') rotations.ensure();
};

// Posts to the bot's staff API as the signed-in staff member, for the admin tools. ?demo answers with sample data.
const call = async (path, body) => {
  if (demo) return demoCall(path, body);
  const token = loadToken();
  if (!token) {
    signedOut('Your sign-in has run out. Sign in again.');
    return { ok: false, json: { error: 'Your sign-in has run out. Sign in again.' } };
  }
  const response = await fetch(botUrl(path), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    forgetToken();
    signedOut('Your sign-in has run out. Sign in again.');
  }
  return { ok: response.ok, json: await response.json().catch(() => null) };
};

const tools = createTools({ root: $('tools'), call, onChanged: () => load(), staff: () => data?.staff ?? {} });

// Linking the signed-in staff member's Steam account. Until they have, the page asks once each sign-in, told apart by
// when it runs out; "Later" waits for the next one.
const STEAM_ASKED_KEY = 'gaminginit-steam-asked';
let steamAskedFor = null;
const thisSignIn = () => String(sessionExpiry(loadToken() ?? '') ?? '');
const askedThisSignIn = () => {
  const signIn = thisSignIn();
  try {
    if (localStorage.getItem(STEAM_ASKED_KEY) === signIn) return true;
  } catch {
    // Kept in memory only.
  }
  return steamAskedFor === signIn;
};
const noteAsked = () => {
  steamAskedFor = thisSignIn();
  try {
    localStorage.setItem(STEAM_ASKED_KEY, steamAskedFor);
  } catch {
    // Kept in memory only.
  }
};

const steamDialog = $('steam-dialog');

const steamError = (text) => {
  $('steam-error').hidden = !text;
  $('steam-error').textContent = text ?? '';
  $('steam-input').setAttribute('aria-invalid', String(Boolean(text)));
};

const openSteam = () => {
  if (steamDialog.open) return;
  const mine = myProfile(data);
  $('steam-form').hidden = false;
  $('steam-done').hidden = true;
  steamDialog.setAttribute('aria-labelledby', 'steam-dialog-title');
  $('steam-dialog-title').textContent = mine ? 'Change your Steam account' : 'Link your Steam account';
  $('steam-save').textContent = mine ? 'Save' : 'Link account';
  $('steam-cancel').textContent = mine ? 'Cancel' : 'Later';
  $('steam-input').value = mine?.player.steamId ?? '';
  steamError(null);
  steamDialog.showModal();
};

const unlinkSteam = async (profile, mine) => {
  const question = mine
    ? 'Unlink your Steam account? Your staff spot comes off the reserved list, and your time on the server counts as seeding again.'
    : `Unlink ${profile.name}’s Steam account? Do this when they are no longer staff: their staff spot comes off the reserved list, and their time on the server counts as seeding again.`;
  if (!window.confirm(question)) return;
  try {
    const { ok, json } = await call('admin/profile', { action: 'unlink', ...(mine ? {} : { userId: profile.userId }) });
    if (!ok) {
      if (loadToken()) showNotice(json?.error ?? 'Couldn’t unlink that just now. Try again in a minute.');
      return;
    }
    load();
  } catch (error) {
    console.error('Could not unlink a Steam account', error);
    showNotice('Couldn’t reach the bot. Try again in a minute.');
  }
};

$('steam-cancel').addEventListener('click', () => steamDialog.close());
$('steam-done-close').addEventListener('click', () => steamDialog.close());
$('staff-steam-mine').addEventListener('click', () => openSteam());
$('steam-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const steamId = readSteamId($('steam-input').value);
  if (steamId === null) {
    steamError('That isn’t a Steam64 ID. It is 17 digits and starts with 7656119. See “How to find it” below.');
    $('steam-input').focus();
    return;
  }
  const save = $('steam-save');
  save.disabled = true;
  try {
    const { ok, json } = await call('admin/profile', { action: 'link', steamId });
    // Saved even when the dialog was closed while it went, so the page shows it either way.
    if (ok) load();
    if (!steamDialog.open) return;
    if (!ok) {
      steamError(json?.error ?? 'Couldn’t save that just now. Try again in a minute.');
      return;
    }
    $('steam-done-text').textContent = steamLinkedText({ steamId, player: json?.player ?? null, sample: json?.sample === true });
    $('steam-form').hidden = true;
    $('steam-done').hidden = false;
    steamDialog.setAttribute('aria-labelledby', 'steam-done-title');
    $('steam-done-close').focus();
  } catch (error) {
    console.error('Could not link a Steam account', error);
    steamError('Couldn’t reach the bot. Try again in a minute.');
  } finally {
    save.disabled = false;
  }
});

// Reads from the bot's staff API as the signed-in staff member.
const get = async (path) => {
  const token = loadToken();
  if (!token) {
    signedOut('Your sign-in has run out. Sign in again.');
    return { ok: false, status: 401, json: { error: 'Your sign-in has run out. Sign in again.' } };
  }
  const response = await fetch(botUrl(path), { headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    forgetToken();
    signedOut('Your sign-in has run out. Sign in again.');
  }
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => null) };
};

const rotations = createRotations({
  root: $('rotations'),
  load: () => (demo ? demoRotations() : get('admin/rotations')),
  send: (body) => (demo ? demoRotationsChange(body) : call('admin/rotations', body)),
});

// The bot's staff commands, once, for the admin tools' forms.
let commandsAsked = false;
const loadCommands = async () => {
  if (commandsAsked) return;
  commandsAsked = true;
  if (demo) {
    tools.setCommands(demoCommands);
    return;
  }
  try {
    const response = await fetch(botUrl('admin/commands'), { headers: { accept: 'application/json', authorization: `Bearer ${loadToken()}` } });
    if (response.status === 404) {
      $('tools-note').textContent = 'The bot does not have the admin tools yet. Deploy the latest bot.';
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    tools.setCommands((await response.json()).commands ?? []);
  } catch (error) {
    console.error('Could not load the admin tools', error);
    // Asked again with the next refresh.
    commandsAsked = false;
  }
};

// A refusal the bot explained, such as staff sign-in not being set up on it.
class BotSaid extends Error {}

const load = async () => {
  clearTimeout(timer);
  lastLoad = Date.now();
  const mine = ++generation;
  const current = () => mine === generation;
  if (demo) {
    show(demoAdmin(period, Date.now()));
    return;
  }
  const token = loadToken();
  if (!token) {
    signedOut(data ? 'Your sign-in has run out. Sign in again.' : null);
    return;
  }
  document.body.classList.add('refreshing');
  try {
    const response = await fetch(botUrl(`admin/overview?days=${period}`), {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
    if (!current()) return;
    if (response.status === 401) {
      forgetToken();
      signedOut('Your sign-in has run out. Sign in again.');
      return;
    }
    if (response.status === 404) {
      signedOut(null);
      showNotice('The bot does not have the staff page yet. Deploy the latest bot.');
      return;
    }
    if (!response.ok) {
      const said = await response.json().then(
        (body) => (typeof body?.error === 'string' ? body.error : null),
        () => null,
      );
      throw said ? new BotSaid(said) : new Error(`HTTP ${response.status}`);
    }
    const overview = await response.json();
    if (!current()) return;
    showNotice();
    show(overview);
  } catch (error) {
    if (!current()) return;
    console.error('Could not load the staff page', error);
    const why = error instanceof BotSaid ? ` The bot says: ${error.message}` : '';
    showNotice(
      (data ? 'Could not refresh. Showing the last we had; trying again in a minute.' : 'Could not load the staff page. Trying again in a minute.') + why,
    );
  } finally {
    if (current()) {
      document.body.classList.remove('refreshing');
      if (!document.hidden && loadToken()) timer = setTimeout(load, REFRESH_MS);
    }
  }
};

for (const button of document.querySelectorAll('.period button[data-days]')) {
  button.addEventListener('click', () => {
    period = Number(button.dataset.days);
    focus = null;
    load();
  });
}

// Tabs: click, or ← → Home End from the tab bar.
for (const t of TABS) {
  $(`tab-${t}`).addEventListener('click', () => {
    $('tools-back').hidden = true;
    selectTab(t);
  });
}
document.querySelector('.admin-tabs').addEventListener('keydown', (event) => {
  const i = TABS.indexOf(tab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  $('tools-back').hidden = true;
  selectTab(TABS[(next + TABS.length) % TABS.length], { focus: true });
});

// The server list's search, sort and "worth a look".
$('player-sort').replaceChildren(...Object.entries(PLAYER_SORTS).map(([value, text]) => el('option', { value, textContent: text })));
$('player-search').addEventListener('input', (event) => {
  filters.query = event.target.value;
  renderPlayers(data);
});
$('player-sort').addEventListener('change', (event) => {
  filters.sort = event.target.value;
  renderPlayers(data);
});
$('player-watch').addEventListener('change', (event) => {
  filters.watch = event.target.checked;
  renderPlayers(data);
});

$('incidents-all').addEventListener('click', () => {
  focus = null;
  render(data);
});

// Only refresh while someone is looking; catch up straight away when they come back, or when nothing has loaded yet.
document.addEventListener('visibilitychange', () => {
  if (demo || !configured || !loadToken()) return;
  if (document.hidden) clearTimeout(timer);
  else if (!data || Date.now() - lastLoad >= REFRESH_MS) load();
  else timer = setTimeout(load, REFRESH_MS - (Date.now() - lastLoad));
});

// Back from signing in: keep the session, and take it out of the address bar and history. The bot sends people back
// with a new page load; a change to the # on this page is handled the same way.
const arrive = (result = signInResult(location.hash)) => {
  if (result) history.replaceState(null, '', location.pathname + location.search);
  if (result?.session) saveToken(result.session);
  if (result?.error) {
    forgetToken();
    signedOut(result.error);
    return;
  }
  load();
};

window.addEventListener('hashchange', () => {
  // A link to a tab, or back and forward between them.
  if (TABS.includes(location.hash.slice(1)) || location.hash === '') {
    selectTab(location.hash.slice(1));
    return;
  }
  if (!demo && configured) arrive();
});

// Read before the tab is picked, as picking one tidies the # away.
const returned = signInResult(location.hash);
selectTab(location.hash.slice(1));

if (demo) {
  showNotice('Showing sample data, not the real server. ', link(thisPage((p) => p.delete('demo')), 'Sign in for the real page'));
  load();
} else if (!configured) {
  showNotice('Live stats are not connected yet. ', link(thisPage((p) => p.set('demo', '')), 'Preview with sample data'));
} else {
  arrive(returned);
}
