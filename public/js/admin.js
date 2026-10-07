import {
  demoAdmin,
  demoCall,
  demoCommands,
  demoFeedKill,
  demoKills,
  demoLines,
  demoLinesChange,
  demoPlayerKills,
  demoPlayerRecord,
  demoRotations,
  demoRotationsChange,
} from './demo.js';
import {
  accountAge,
  alertCount,
  BUTTON_BACKGROUND,
  clockHour,
  DEATH_TAGS,
  factionColours,
  feedEmpty,
  feedKillShown,
  filterPlayers,
  flaggedDaysLabel,
  flagLabel,
  flagRule,
  formatDuration,
  formatHours,
  headshotCount,
  headshotRule,
  headshotShare,
  kd,
  killerSummary,
  luckOdds,
  metres,
  modActionCounts,
  modActionLabel,
  needsLook,
  oddsKind,
  ordinaryHeadshots,
  percent,
  PLAYER_SORTS,
  plural,
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
  usualHeadshots,
  utcDay,
  watchList,
  WEAPON_KINDS,
  withVehicle,
} from './format.js';
import { createLines } from './lines.js';
import { demo, showNotice, thisPage } from './live.js';
import { createRotations } from './rotations.js';
import { createTools, replyNodes } from './tools.js';
import { el, link, mapTag, playerHref } from './views.js';

// The staff page, in six tabs. Live: the server now, everyone in game, to search and act on, every kill as it happens,
// and who joined and left. Review: what the bot flagged by itself, to look at: far more headshots than a player's
// weapons usually get, risky Steam accounts, possible griefers and their team kills and vehicle suicides; and the
// moderation log of what staff did. History: any player's record, kills and headshots, and team kills. Admin: the admin tools (every staff command),
// the bans on the server and the reserved slots. Rotations: the map rotations, the week and what is on the server (see
// rotations.js). Lines: what the bot says in game (see lines.js). Any player's name opens their history. Staff sign in with Discord through the bot; the bot checks they are staff and sends them back with a
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
const TABS = ['live', 'review', 'history', 'admin', 'rotations', 'lines'];
const TAB_NAMES = { live: 'Live', review: 'Review', history: 'History', admin: 'Admin', rotations: 'Rotations', lines: 'Lines' };
// The tabs the page had before, which old links name.
const OLD_TABS = { players: 'live', alerts: 'review', kills: 'review' };
let tab = 'live';
// The server list's search, team (a sideKey, '' for every team, 'none' for no team), "worth a look" and order, which
// starts with those worth a look at the top.
const filters = { query: '', team: '', watch: false, sort: 'watch' };
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
// The headshots list for the period (GET /api/admin/kills), loaded with each refresh, and the kill feed: the server's
// latest kills, newest first, which the bot sends as they come in (see connectFeed).
let kills = null;
let feed = [];
let killsGeneration = 0;
// The player on the History tab ({ steamId, name }), which the address keeps as #history/<Steam ID>, so Back goes back:
// their kills (GET /api/admin/kills?player=) and their record ({ steamId, reply }: the /player command's reply, as Look
// up shows it, or { steamId, error }). Each load has its own generation, as `generation` is for the rest.
let historyPlayer = null;
let historyKills = null;
let historyRecord = null;
let historyGeneration = 0;
// New kills or history that came while an Act menu was open, as for `waiting`.
let killsWaiting = false;
// "Only headshots" and "Only team kills" on the kill feed, and "Only headshots" on a player's kills.
const killFilters = { feed: { headshots: false, teamKills: false }, history: false };
// "Show ordinary players" on the Review tab's headshots: off, those whose headshots are ordinary and who have no flagged
// day are left out.
let showOrdinary = false;

// In the reader's own time: "Fri 3 Oct, 21:40".
const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });

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
  lines.reset();
  disconnectFeed();
  killsGeneration += 1;
  historyGeneration += 1;
  kills = null;
  historyKills = null;
  historyRecord = null;
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

// A player's name, opening their history, with their Steam ID linking to their Steam profile.
const who = (player) =>
  el(
    'span',
    { className: 'staff-player' },
    el('button', { type: 'button', className: 'link-button player-name', textContent: player.name, onclick: () => openHistory(player) }),
    steamLink(player.steamId),
  );

const badge = (text, kind = '') => el('span', { className: `badge${kind ? ` badge-${kind}` : ''}`, textContent: text });

// What the address keeps after the # for the tab shown, and on the History tab the player shown.
const tabHash = () => (tab === 'live' ? '' : tab === 'history' && historyPlayer ? `#history/${historyPlayer.steamId}` : `#${tab}`);

const selectTab = (name, { focus = false } = {}) => {
  tab = TABS.includes(name) ? name : 'live';
  for (const t of TABS) {
    const on = t === tab;
    $(`tab-${t}`).setAttribute('aria-selected', String(on));
    $(`tab-${t}`).tabIndex = on ? 0 : -1;
    $(`panel-${t}`).hidden = !on;
  }
  if (focus) $(`tab-${tab}`).focus();
  const hash = tabHash();
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  // Loaded when first opened, as only staff working on rotations or lines need them.
  if (tab === 'rotations' && data) rotations.show();
  if (tab === 'lines' && data) lines.show();
  // A player's history is drawn straight away with what the page knows, and loaded when it is not yet.
  if (tab === 'history' && data) {
    renderHistory();
    if (historyPlayer !== null && !historyLoaded()) loadHistory();
  }
};

// The tab and player an address names after the #: '' for Live, '#review', '#history/<Steam ID>'. Old links to
// '#players', '#alerts', '#kills' and '#kills/<Steam ID>' go where those are now.
const fromHash = (hash) => {
  const [asked, id] = hash.slice(1).split('/');
  const steamId = (asked === 'history' || asked === 'kills') && /^\d{17}$/.test(id ?? '') ? id : null;
  if (steamId !== null) return { name: 'history', steamId };
  return { name: Object.hasOwn(OLD_TABS, asked) ? OLD_TABS[asked] : asked, steamId: null };
};
const isTabHash = (hash) => hash === '' || TABS.includes(fromHash(hash).name);

// The best name the page has for a Steam ID, until the bot sends theirs.
const knownName = (steamId) =>
  [
    ...(kills?.players ?? []),
    ...feed.flatMap((k) => [k.killer, k.victim]),
    ...(historyKills ? [historyKills.player] : []),
    ...(data?.online?.players ?? []),
  ].find((p) => p.steamId === steamId)?.name ?? steamId;

// Shows the tab and player the address names.
const route = () => {
  const { name, steamId } = fromHash(location.hash);
  if (name === 'history') historyPlayer = steamId === null ? null : { steamId, name: knownName(steamId) };
  selectTab(name);
};

// Goes to a player's history, from their name anywhere on the page or a row's Act menu. Back comes back.
const openHistory = (player) => {
  historyPlayer = { steamId: player.steamId, name: player.name };
  const hash = `#history/${player.steamId}`;
  if (location.hash !== hash) history.pushState({ player: player.steamId }, '', location.pathname + location.search + hash);
  $('tools-back').hidden = true;
  closeMenus();
  selectTab('history');
  $('history-player').scrollIntoView({ block: 'start' });
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

// What staff can do to a player from a row. Warnings, kicks and team moves only work on someone in game. History is not
// an admin tool: it opens the History tab.
const ACTIONS = [
  { key: 'history', label: 'History', note: 'Kills and headshots, team kills, Steam account, bans and staff history', inGame: false },
  { key: 'warn', label: 'Warn', note: 'A private message in game', inGame: true },
  { key: 'kick', label: 'Kick', note: 'They see the reason, and can rejoin', inGame: true },
  { key: 'switchteam', label: 'Move to another team', note: 'They respawn on the new side', inGame: true },
  { key: 'ban', label: 'Ban', note: 'For a set time or for good', inGame: false },
  { key: 'private:add', label: 'Make profile private', note: 'Shown as [private profile] on the website and in public posts', inGame: false },
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
            if (a.key === 'history') openHistory(player);
            else act(a.key, player);
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
      if (document.querySelector('.act-menu[open]')) return;
      if (waiting) {
        const next = waiting;
        waiting = null;
        render(next);
      }
      if (killsWaiting) renderKills();
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

// The alert lists whose "Not in game" part staff opened, by the list's id, so a refresh keeps it open.
const awayOpen = new Set();

// An alert list in two parts: players in game now first, as the ones staff can still warn, kick or move, then everyone
// else seen in the period, folded away until staff open it. While the server is not answering nobody is known to be in
// game, so it is one list.
const inGameFirst = (node, overview, { headers, items, row, empty, emptyInGame }) => {
  const grid = (labelId, rows, text) => {
    const t = el('table', { className: 'admin-table' });
    if (labelId) t.setAttribute('aria-labelledby', labelId);
    table(t, headers, rows, text);
    return el('div', { className: 'admin-scroll' }, t);
  };
  if (overview.online === null) {
    node.replaceChildren(grid(null, items.map(row), empty));
    return;
  }
  // The count is in the alert colour when someone in game has an alert.
  const count = (list, alert) =>
    el('span', { className: `tab-count${alert && list.length > 0 ? ' tab-count-alert' : ''}`, textContent: String(list.length) });
  const here = items.filter((p) => onlineIds.has(p.steamId));
  const away = items.filter((p) => !onlineIds.has(p.steamId));
  const hereId = `${node.id}-ingame`;
  const awayId = `${node.id}-away`;
  const awayGroup = () => {
    const box = el(
      'details',
      { className: 'alert-group away-group', open: awayOpen.has(node.id) },
      el('summary', { className: 'group-title', id: awayId }, 'Not in game', count(away, false)),
      grid(awayId, away.map(row), ''),
    );
    box.addEventListener('toggle', () => (box.open ? awayOpen.add(node.id) : awayOpen.delete(node.id)));
    return box;
  };
  // A refresh keeps keyboard focus on "Not in game", without scrolling to it, when the one it replaces had it.
  const focused = document.activeElement?.id === awayId && node.contains(document.activeElement);
  node.replaceChildren(
    el(
      'section',
      { className: 'alert-group' },
      el('h3', { className: 'group-title', id: hereId }, el('span', { className: 'online-dot', ariaHidden: 'true' }), 'In game now', count(here, true)),
      grid(hereId, here.map(row), items.length === 0 ? empty : emptyInGame),
    ),
    ...(away.length === 0 ? [] : [awayGroup()]),
  );
  if (focused) document.getElementById(awayId)?.focus({ preventScroll: true });
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
  const row = (p) =>
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
      number(withVehicle(p.teamKills, p.vehicleTeamKills, p.crashTeamKills)),
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
    );
  inGameFirst($('griefers'), overview, {
    headers: [
      'Player',
      ['Team kills', 'num'],
      'Killed most',
      ['Killed by team', 'num'],
      ['Suicides', 'num'],
      ['Matches', 'num'],
      ['Played', 'num'],
      '',
    ],
    items: overview.players,
    row,
    empty: 'Nobody team killed or killed themselves in this period.',
    emptyInGame: 'Nobody in game team killed or killed themselves in this period.',
  });
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

// `scores` gives each team's colour in game.
const renderTeamFilter = (players, scores) => {
  const teams = teamCounts(players);
  // A team picked before that is no longer in game falls back to everyone.
  if (filters.team && !teams.some((t) => (t.name === null ? 'none' : sideKey(t.name)) === filters.team)) filters.team = '';
  const button = (value, text, count, colour) => {
    // A team's name in its colour, to spot at a glance.
    const name = el('span', { textContent: text });
    if (colour) name.style.color = colour;
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
      name,
      el('span', { className: 'filter-count', textContent: String(count) }),
    );
    b.dataset.key = value;
    return b;
  };
  // The server's colour for a team, or the faction's own when the server sent none, readable on a pressed button.
  const colours = sideColours([{ factionScores: scores }], BUTTON_BACKGROUND);
  const colourOf = (name) => colours.get(sideKey(name)) ?? factionColours.get(sideKey(name)) ?? null;
  replaceButtons($('team-filter'), [
    button('', 'All', players.length),
    ...teams.map((t) => (t.name === null ? button('none', 'No team', t.count) : button(sideKey(t.name), t.name, t.count, colourOf(t.name)))),
  ]);
};

// Everyone in game, as staff searched, filtered and sorted it.
const renderPlayers = (overview) => {
  if (!overview) return;
  const online = overview.online;
  const players = online?.players ?? [];
  const today = utcDay(overview.generatedAt);
  const colours = sideColours([{ factionScores: overview.server?.factionScores ?? [] }]);
  renderTeamFilter(players, overview.server?.factionScores ?? []);
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
              textContent: `Find “${query}” among everyone the bot knows`,
              onclick: () => findPlayer(query),
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

// A team kill or vehicle suicide, here and on the History tab. The bot sends the period's latest 300.
const INCIDENTS_NOTE = '300 team kills and vehicle suicides';
const INCIDENT_HEADERS = ['When', 'What', 'Player', 'Teammate killed', 'With', ['Distance', 'num'], 'Map'];
const incidentRow = (i) =>
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
  );

const renderIncidents = (overview) => {
  const shown = overview.incidents.filter((i) => focus === null || i.player.steamId === focus || i.victim?.steamId === focus);
  const focused = focus === null ? null : (overview.players.find((p) => p.steamId === focus) ?? null);
  $('incidents-all').hidden = focus === null;
  $('incidents-note').textContent =
    focused === null
      ? 'Newest first. Sides come from the bot’s check each minute, so a player who switched sides in the last minute can ' +
        'show wrongly. Other suicides are only counted.'
      : `Involving ${focused.name}, newest first.`;
  table(
    $('incidents'),
    INCIDENT_HEADERS,
    shown.map(incidentRow),
    focused === null ? 'No team kills or vehicle suicides in this period.' : `None involving ${focused.name} in this period.`,
  );
};

// When something was noticed, and after a gap in the bot's checks, since when: it happened some time between the two.
const whenSince = (at, from) =>
  el(
    'td',
    { className: 'when' },
    when.format(at),
    from === null
      ? null
      : el('span', {
          className: 'join-gap',
          textContent: `since ${when.format(from)}`,
          title: 'The bot couldn’t read the server in between, so this happened some time between the two.',
        }),
  );

// Who joined and left the server, newest first. After the bot could not read the server for a while, it only knows
// a join or leave happened since its check before (`from`). Hidden for a bot that does not send them.
const renderJoins = (overview) => {
  $('joins-card').hidden = overview.joins === undefined;
  if (overview.joins === undefined) return;
  const rows = overview.joins.map((e) =>
    el(
      'tr',
      {},
      whenSince(e.at, e.from),
      cell(e.kind === 'joined' ? badge('Joined', 'accent') : badge('Left')),
      el('td', { className: 'player' }, who(e.player)),
      e.kind === 'joined'
        ? cell()
        : e.minutes === null
          ? el('td', { className: 'num muted', textContent: '–', title: 'They were on when the bot started keeping this log.' })
          : el('td', { className: 'num', textContent: formatDuration(e.minutes * 60_000) }),
    ),
  );
  table($('joins'), ['When', 'What', 'Player', ['On for', 'num']], rows, 'Nobody has joined or left since the bot started keeping this log.');
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
  const row = (a) =>
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
          a.banned ? badge('Banned', 'accent') : null,
        ),
      ),
      el('td', { className: 'reason' }, steamWhy(a, now).join(' · ') || '–', el('span', { className: 'badges' }, ...a.flags.map((f) => badge(steamFlagLabel(f))))),
      el('td', { className: 'when' }, accountAge(a, now), el('span', { className: 'muted checked', textContent: `Checked ${when.format(a.checkedAt)}` })),
      el('td', { className: 'num', textContent: a.matches > 0 ? `${a.matches} · ${kd(a.kills, a.deaths)} K/D` : '–' }),
      el('td', { className: 'num', textContent: headshotShare(a.feedKills, a.headshots) ?? '–' }),
      el('td', { className: 'num', textContent: a.minutes > 0 ? formatHours(a.minutes) : '–' }),
      el('td', { className: 'row-actions' }, actMenu(a)),
    );
  inGameFirst($('steam-accounts'), overview, {
    headers: ['Player', 'Why', 'Account', ['Matches', 'num'], ['Headshots', 'num'], ['Played', 'num'], ''],
    items: steam.accounts,
    row,
    empty: 'No risky accounts among the players in this period.',
    emptyInGame: 'Nobody in game has a risky Steam account.',
  });
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

// Kills: the live kill feed (Live), the headshots list (Review) and a player's kills (History).

// In the reader's own time, to the second, as kills come seconds apart: "Fri 3 Oct, 21:40:12", or only "21:40:12" for a
// kill from today.
const whenKill = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit', second: '2-digit' });
const timeKill = new Intl.DateTimeFormat(undefined, { hour: clockHour(), minute: '2-digit', second: '2-digit' });

// When a kill happened. A kill from today shows only its time, as the date would repeat on every row of a long list; an
// older one shows the date as well. The full date and time are always in the hover.
const killWhen = (at) =>
  el(
    'td',
    { className: 'when' },
    el('time', {
      dateTime: new Date(at).toISOString(),
      title: whenKill.format(at),
      textContent: (new Date(at).toDateString() === new Date().toDateString() ? timeKill : whenKill).format(at),
    }),
  );

// A UTC day: "Fri 3 Oct".
const utcDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const killsStatus = (text) => {
  $('kills-status').hidden = !text;
  setStatus($('kills-status'), text ?? '');
};

// The chance of a player's headshots by luck, coloured when it is low.
const odds = (chance, flag) => {
  const kind = oddsKind(chance, flag);
  return kind ? badge(luckOdds(chance), kind) : luckOdds(chance);
};

// A weapon the bot has no name for: the game's own kill feed has it (see renderUnnamed).
const uncheckedName = () => {
  const mark = badge('Check name', 'hot');
  mark.title = 'The bot has no name for this weapon yet, so this is the game’s code for it. See Weapons to name on the Review tab.';
  return mark;
};

// The map a kill was on, only when it differs from the kill above it (`above`, the row before it in the list, if any):
// a match is on one map for a long run of kills. Staff who read the table with a screen reader still get it.
const killMap = (k, above) =>
  above !== undefined && (above.map ?? '') === (k.map ?? '')
    ? el('td', { className: 'map-same' }, k.map ? el('span', { className: 'visually-hidden', textContent: k.map }) : null)
    : cell(k.map ? mapTag(k.map) : '–');

// A kill's weapon, what sort it is when not carried by hand, what the game said about it, and whether it was a team
// kill; then whether it was a headshot, how far, and where.
const killCells = (k, above) => [
  cell(
    k.weapon,
    WEAPON_KINDS[k.weaponKind] ? el('span', { className: 'kill-distance', textContent: ` · ${WEAPON_KINDS[k.weaponKind]}` }) : null,
    ...k.tags.filter((t) => DEATH_TAGS[t] && t !== 'Suicide').map((t) => el('span', { className: 'kill-distance', textContent: ` · ${DEATH_TAGS[t]}` })),
    k.teamKill || k.weaponNamed === false
      ? el(
          'span',
          { className: 'badges' },
          k.teamKill ? badge('Team kill', 'bad') : null,
          // Older bots don't say, so only a weapon the bot says it has no name for is marked.
          k.weaponNamed === false ? uncheckedName() : null,
        )
      : null,
  ),
  cell(k.headshot ? badge('Headshot', 'accent') : ''),
  el('td', { className: 'num', textContent: k.distance === null ? '–' : metres(k.distance) }),
  killMap(k, above),
];

// The kill feed shows the latest kills, up to as many as the bot keeps.
const FEED_SHOWN = 250;
const FEED_HEADERS = ['When', 'Killer', 'Killed', 'With', 'Headshot', ['Distance', 'num'], 'Map'];
const FEED_STATES = { live: 'Live', connecting: 'Connecting…', retrying: 'Reconnecting…', off: 'Every minute', sample: 'Sample' };

// `above` is the kill in the row above, which the map is compared with.
const feedRow = (k, above) =>
  el(
    'tr',
    {},
    killWhen(k.at),
    el('td', { className: 'player' }, who(k.killer)),
    el('td', { className: 'player' }, who(k.victim)),
    ...killCells(k, above),
  );

const feedShown = (k) => feedKillShown(k, killFilters.feed);

const feedNote = () =>
  setStatus(
    $('feed-note'),
    `The server’s latest ${feed.length} kills, newest first${socketState === 'live' || socketState === 'sample' ? ', as they happen' : ''}. Click a name for their history.`,
  );

const renderFeed = () => {
  feedNote();
  const shown = feed.filter(feedShown);
  table($('kill-feed'), FEED_HEADERS, shown.map((k, i) => feedRow(k, shown[i - 1])), feedEmpty(feed.length, killFilters.feed));
};

// New kills, newest first, added at the top without redrawing the rest, so a name staff are about to click stays put.
const addFeed = (added) => {
  feed = [...added, ...feed].slice(0, FEED_SHOWN);
  const node = $('kill-feed');
  const body = node.tBodies[0];
  const shown = feed.filter(feedShown);
  // Drawn whole when it had no rows, or has none now, so it says why.
  if (!node.tHead || !body || shown.length === 0) {
    renderFeed();
    return;
  }
  feedNote();
  const fresh = added.filter(feedShown);
  const rows = fresh.map((k, i) => {
    const row = feedRow(k, fresh[i - 1]);
    row.classList.add('kill-new');
    return row;
  });
  body.prepend(...rows);
  // The kill that was at the top now has one above it, so its map may no longer need showing.
  if (rows.length > 0 && shown[rows.length] !== undefined) body.rows[rows.length].lastElementChild.replaceWith(killMap(shown[rows.length], shown[rows.length - 1]));
  while (body.rows.length > shown.length) body.lastElementChild.remove();
};

// The live kill feed (GET /api/admin/live): a WebSocket the bot sends each batch of kills down as it comes in. The
// session goes as its second subprotocol, as a browser can't send a header with one. While it is down, the feed comes
// with each refresh instead, and the page tries again, waiting longer each time.
const SOCKET_WAITS_MS = [2_000, 5_000, 15_000, 30_000];
const PING_MS = 30_000;
let socket = null;
let socketState = 'off';
let socketTries = 0;
let socketTimer = 0;
let pingTimer = 0;

const feedState = (state) => {
  socketState = state;
  const node = $('feed-state');
  node.dataset.state = state;
  setStatus(node, FEED_STATES[state]);
};

const connectFeed = () => {
  if (demo || !configured || socket || document.hidden) return;
  const token = loadToken();
  if (!token) return;
  clearTimeout(socketTimer);
  const url = new URL(botUrl('admin/live'));
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  feedState(socketTries === 0 ? 'connecting' : 'retrying');
  let ws;
  try {
    ws = new WebSocket(url, ['wardogs-staff', token]);
  } catch (error) {
    console.error('Could not open the live kill feed', error);
    feedState('off');
    return;
  }
  socket = ws;
  ws.addEventListener('open', () => {
    socketTries = 0;
    feedState('live');
    clearInterval(pingTimer);
    pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
  });
  ws.addEventListener('message', (event) => {
    if (event.data === 'pong') return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'feed') {
        feed = message.feed.slice(0, FEED_SHOWN);
        renderFeed();
      } else if (message.type === 'kills') addFeed(message.kills);
    } catch (error) {
      console.error('Could not read the live kill feed', error);
    }
  });
  ws.addEventListener('close', (event) => {
    if (socket !== ws) return;
    socket = null;
    clearInterval(pingTimer);
    // The session ran out: the next load asks to sign in again.
    if (event.code === 4401 || !loadToken()) {
      feedState('off');
      if (event.code === 4401) load();
      return;
    }
    const wait = SOCKET_WAITS_MS[Math.min(socketTries, SOCKET_WAITS_MS.length - 1)];
    socketTries += 1;
    feedState('retrying');
    socketTimer = setTimeout(connectFeed, wait);
  });
};

const disconnectFeed = () => {
  clearTimeout(socketTimer);
  clearInterval(pingTimer);
  socketTries = 0;
  const ws = socket;
  socket = null;
  ws?.close(1000);
  if (!demo) feedState('off');
};

// ?demo: a sample kill every few seconds, as if the server were busy.
const DEMO_FEED_MS = 4_000;
let demoKillCount = 0;
const startDemoFeed = () => {
  feedState('sample');
  setInterval(() => {
    if (!document.hidden && data) addFeed([demoFeedKill(demoKillCount++, Date.now())]);
  }, DEMO_FEED_MS);
};

// Review: who gets far more headshots than their weapons usually do.
const renderHeadshots = () => {
  const flag = kills.flag;
  const { totals } = kills;
  $('headshot-rules').replaceChildren(
    el('li', {}, el('strong', { textContent: 'Usual' }), ' is how many headshots a player would get with the same kills by weapon, at the share of headshots everyone else gets with each weapon over the last 30 days. A sniper rifle’s usual is high, a machine gun’s low, so snipers are not flagged for sniping.'),
    el('li', {}, el('strong', { textContent: 'Chance by luck' }), ' is how often a player with that usual aim would get as many headshots or more. “Ordinary” is 1 in 20 or likelier.'),
    el('li', {}, badge('Flagged', 'bad'), ` ${headshotRule(flag)}.`),
    el('li', {}, 'An honest player has a lucky day now and then. Flagged day after day is the red flag. Check their history, and watch them play, before you act.'),
  );
  const ordinary = kills.players.filter(ordinaryHeadshots);
  const hiding = !showOrdinary && ordinary.length > 0;
  $('headshots-ordinary-label').hidden = ordinary.length === 0;
  setStatus($('headshots-ordinary-text'), `Show ordinary players (${ordinary.length})`);
  $('headshots-note').textContent = kills.since
    ? `${totals.kills.toLocaleString('en-GB')} kills in this period, ${percent(totals.kills > 0 ? totals.headshots / totals.kills : null)} of them headshots. ` +
      (hiding
        ? 'Everyone with a headshot who stands out, most flagged days first, then least likely by luck. Those with an ordinary chance by luck and no flagged day are hidden unless you show them. '
        : 'Everyone with a headshot, most flagged days first, then least likely by luck. ') +
      'Click a name for their history.'
    : 'No kills yet. They start with the first kill after the bot is updated.';
  const row = (p) =>
    el(
      'tr',
      {},
      el('td', { className: 'player' }, who(p), p.flaggedDays > 0 ? el('span', { className: 'badges' }, badge(flaggedDaysLabel(p.flaggedDays), 'bad')) : null),
      number(headshotCount(p.kills, p.headshots)),
      number(usualHeadshots(p.expected, p.kills)),
      el('td', { className: 'num' }, odds(p.chance, flag)),
      cell(p.weapon ?? '–'),
      el('td', { className: 'row-actions' }, actMenu(p)),
    );
  inGameFirst($('headshots'), data, {
    headers: ['Player', ['Headshots', 'num'], ['Usual', 'num'], ['Chance by luck', 'num'], 'Most kills with', ''],
    items: hiding ? kills.players.filter((p) => !ordinaryHeadshots(p)) : kills.players,
    row,
    empty: hiding ? 'Nobody stands out in this period. Show ordinary players to see everyone with a headshot.' : 'Nobody got a headshot in this period.',
    emptyInGame: hiding && ordinary.some((p) => onlineIds.has(p.steamId)) ? 'Nobody in game stands out.' : 'Nobody in game got a headshot in this period.',
  });
};

// Review: the weapons the bot has no name for, so the page shows the game's code for them, with who used them most, those
// in game first, as the ones to watch in game. Hidden when there are none, or the bot does not send them.
const renderUnnamed = () => {
  const weapons = kills.unnamedWeapons ?? [];
  $('unnamed-panel').hidden = weapons.length === 0;
  $('count-unnamed').textContent = weapons.length > 0 ? String(weapons.length) : '';
  const users = (w) =>
    cell(
      ...w.players.map((p) =>
        el(
          'div',
          { className: 'unnamed-user' },
          who(p),
          el('span', { className: 'kill-distance', textContent: plural(p.kills, 'kill') }),
          p.inGame ? badge('In game', 'accent') : null,
        ),
      ),
      w.users > w.players.length ? el('div', { className: 'muted', textContent: `and ${w.users - w.players.length} more` }) : null,
    );
  const row = (w) =>
    el(
      'tr',
      {},
      cell(w.name, WEAPON_KINDS[w.kind] ? el('span', { className: 'kill-distance', textContent: ` · ${WEAPON_KINDS[w.kind]}` }) : null),
      number(w.kills.toLocaleString('en-GB')),
      el('td', { className: 'num', textContent: w.longest === null ? '–' : metres(w.longest) }),
      el('td', { className: 'when', textContent: utcDate.format(Date.parse(w.lastDay)) }),
      users(w),
    );
  table($('unnamed-weapons'), ['Weapon', ['Kills', 'num'], ['Longest', 'num'], 'Last used', 'Used most by'], weapons.map(row), '');
};

// The Review tab's count and headshot tile, which need the headshots list as well as the overview.
const renderReviewCounts = () => {
  if (!data) return;
  const flagged = kills?.totals.flaggedPlayers ?? 0;
  const alerts = alertCount(data) + flagged;
  $('count-review').textContent = String(alerts);
  $('count-review').classList.toggle('tab-count-alert', alerts > 0);
  $('tile-headshot-flags').textContent = kills ? String(flagged) : '–';
  $('tile-headshot-flags-note').textContent =
    kills && data.online ? `${kills.players.filter((p) => p.flaggedDays > 0 && onlineIds.has(p.steamId)).length} in game` : '';
};

const renderKills = () => {
  killsWaiting = false;
  renderReviewCounts();
  if (kills !== null) {
    renderHeadshots();
    renderUnnamed();
  }
  if (tab === 'history') renderHistory();
};

// Draws new kills, or keeps them until an open Act menu closes.
const showKills = () => {
  if (document.querySelector('.act-menu[open]')) killsWaiting = true;
  else renderKills();
};

// The headshots list for the period, with each refresh, and the feed with it while the live feed is down.
const loadKills = async () => {
  const mine = ++killsGeneration;
  const days = period;
  try {
    const { ok, status, json } = demo ? { ok: true, status: 200, json: demoKills(days, Date.now()) } : await get(`admin/kills?days=${days}`);
    if (mine !== killsGeneration || status === 401) return;
    if (status === 404) {
      killsStatus('The bot does not have the kill feed for staff yet. Deploy the latest bot.');
      return;
    }
    if (!ok) throw new Error(json?.error ?? `HTTP ${status}`);
    killsStatus(null);
    kills = json;
    // The live feed sends its own; until it has, or while it is down, the feed comes from here.
    if ((socketState !== 'live' && socketState !== 'sample') || feed.length === 0) {
      feed = json.feed.slice(0, FEED_SHOWN);
      renderFeed();
    }
    showKills();
  } catch (error) {
    if (mine !== killsGeneration) return;
    console.error('Could not load the kills', error);
    killsStatus(kills ? 'Could not refresh the headshots. Showing the last we had; trying again in a minute.' : 'Could not load the headshots. Trying again in a minute.');
  }
};

// History: one player's record, kills and team kills.

const historyLoaded = () => historyKills !== null && historyKills.player.steamId === historyPlayer?.steamId && historyKills.days === period;

const renderHistoryList = () => {
  const k = historyKills;
  const shown = k.list.filter((kill) => !killFilters.history || kill.headshot);
  $('history-note').textContent =
    k.list.length < k.kills ? `Their latest ${k.list.length} of ${k.kills} kills, newest first.` : `Newest first.${k.kills > 0 ? ' Click a name for that player’s history.' : ''}`;
  table(
    $('history-list'),
    ['When', 'Killed', 'With', 'Headshot', ['Distance', 'num'], 'Map'],
    shown.map((kill, i) => el('tr', {}, killWhen(kill.at), el('td', { className: 'player' }, who(kill.victim)), ...killCells(kill, shown[i - 1]))),
    k.list.length === 0 ? 'No kills in this period.' : 'No headshots among them.',
  );
};

const renderHistoryKills = () => {
  const loaded = historyLoaded();
  $('history-kills').hidden = !loaded;
  $('history-loading').hidden = loaded;
  if (!loaded) {
    $('history-loading').textContent = 'Loading their kills…';
    return;
  }
  const k = historyKills;
  $('history-summary').textContent = killerSummary(k);
  table(
    $('history-weapons'),
    ['Weapon', ['Headshots', 'num'], ['Usual', 'num']],
    k.weapons.map((w) =>
      el(
        'tr',
        {},
        cell(w.name, WEAPON_KINDS[w.kind] ? el('span', { className: 'kill-distance', textContent: ` · ${WEAPON_KINDS[w.kind]}` }) : null),
        number(headshotCount(w.kills, w.headshots)),
        number(usualHeadshots(w.expected, w.kills)),
      ),
    ),
    'No kills in this period.',
  );
  table(
    $('history-days'),
    ['Day (UTC)', ['Headshots', 'num'], ['Usual', 'num'], ['Chance by luck', 'num']],
    k.byDay.map((d) =>
      el(
        'tr',
        {},
        el('td', { className: 'when' }, utcDate.format(Date.parse(d.day)), d.flagged ? el('span', { className: 'badges' }, badge('Flagged', 'bad')) : null),
        number(headshotCount(d.kills, d.headshots)),
        number(usualHeadshots(d.expected, d.kills)),
        el('td', { className: 'num' }, odds(d.chance, k.flag)),
      ),
    ),
    'No kills in this period.',
  );
  renderHistoryList();
};

// Their times on the server in the period, newest first, with the one they are on now first. Hidden for a bot that does
// not send them.
const renderHistorySessions = () => {
  const sessions = historyLoaded() ? historyKills.sessions : undefined;
  $('history-sessions-section').hidden = sessions === undefined;
  if (sessions === undefined) return;
  const total = sessions.reduce((n, s) => n + (s.minutes ?? 0), 0);
  $('history-sessions-note').textContent =
    sessions.length === 0
      ? 'From the bot’s check each minute, so each time shows up to a minute late.'
      : `${plural(sessions.length, 'time')} on the server, ${formatDuration(total * 60_000)} in all. Newest first, from the bot’s check each minute, so each time shows up to a minute late.`;
  table(
    $('history-sessions'),
    ['Joined', 'Left', ['On for', 'num']],
    sessions.map((s) =>
      el(
        'tr',
        {},
        s.joinedAt === null
          ? el('td', { className: 'when muted', textContent: 'Already on', title: 'They were on when the bot started keeping this log.' })
          : whenSince(s.joinedAt, s.joinedFrom),
        s.leftAt === null ? el('td', { className: 'when' }, badge('In game now', 'accent')) : whenSince(s.leftAt, s.leftFrom),
        el('td', { className: s.minutes === null ? 'num muted' : 'num', textContent: s.minutes === null ? '–' : formatDuration(s.minutes * 60_000) }),
      ),
    ),
    'Not on the server in this period.',
  );
};

// Their team kills and vehicle suicides, and team kills on them, from the Review tab's list.
const renderHistoryGrief = (steamId) => {
  const row = data?.players.find((p) => p.steamId === steamId) ?? null;
  $('history-grief-note').textContent =
    row === null
      ? 'No team kills, team deaths or suicides in this period.'
      : `${plural(row.teamKills, 'team kill')} (${row.vehicleTeamKills} with a vehicle` +
        `${row.crashTeamKills > 0 ? `, ${row.crashTeamKills} in a helicopter crash` : ''}), killed by a teammate ${plural(row.teamKilled, 'time')}, ` +
        `${plural(row.suicides, 'suicide')} (${row.vehicleSuicides} in a vehicle). Newest first, from the latest ${INCIDENTS_NOTE} in the period.`;
  const shown = (data?.incidents ?? []).filter((i) => i.player.steamId === steamId || i.victim?.steamId === steamId);
  table($('history-incidents'), INCIDENT_HEADERS, shown.map(incidentRow), 'None in this period.');
};

const renderHistory = () => {
  $('history-player').hidden = historyPlayer === null;
  const days = period === 1 ? 'Today' : `The last ${period} days`;
  setStatus($('history-period-note'), `${days} (UTC days), for their time on the server, kills and team kills. Their record covers the last 90 days.`);
  if (historyPlayer === null) return;
  const { steamId } = historyPlayer;
  const loaded = historyLoaded();
  const player = loaded ? historyKills.player : { ...historyPlayer, inGame: onlineIds.has(steamId) };
  $('history-title').textContent = player.name;
  const ban = data?.bans?.find((b) => b.player.steamId === steamId) ?? null;
  const griefRow = data?.players.find((p) => p.steamId === steamId) ?? null;
  $('history-head').replaceChildren(
    el(
      'span',
      { className: 'staff-player' },
      player.id ? el('a', { className: 'player-link', href: playerHref(player.id), textContent: 'Public player page' }) : null,
      steamLink(steamId),
    ),
    el(
      'span',
      { className: 'badges' },
      onlineIds.has(steamId) ? badge('In game', 'accent') : null,
      ban ? badge(ban.onServer ? 'Banned' : 'Ban waiting', 'bad') : null,
      loaded && historyKills.flaggedDays > 0 ? badge(`Headshots: ${flaggedDaysLabel(historyKills.flaggedDays).toLowerCase()}`, 'bad') : null,
      ...(griefRow?.flags ?? []).map((f) => badge(flagLabel(f), FLAG_KIND[f])),
    ),
  );
  $('history-act').replaceChildren(actMenu({ steamId, name: player.name }));
  const record = historyRecord?.steamId === steamId ? historyRecord : null;
  $('history-record').replaceChildren(
    ...(record === null
      ? [el('p', { className: 'muted', textContent: 'Loading their record…' })]
      : record.reply
        ? replyNodes(record.reply, data?.staff ?? {})
        : [el('p', { className: 'tool-error', textContent: record.error })]),
  );
  renderHistorySessions();
  renderHistoryKills();
  renderHistoryGrief(steamId);
};

// Their kills for the period, with each refresh while History is open, and their record once each time they are opened.
const loadHistory = async () => {
  if (historyPlayer === null) return;
  const mine = ++historyGeneration;
  const shown = historyPlayer;
  const days = period;
  const wantRecord = historyRecord?.steamId !== shown.steamId;
  const recordCall = !wantRecord
    ? null
    : demo
      ? Promise.resolve({ ok: true, json: demoPlayerRecord(shown.steamId, Date.now()) })
      : call('admin/command', { name: 'player', options: { player: shown.steamId } });
  try {
    const [killsAnswer, recordAnswer] = await Promise.all([
      demo ? { ok: true, status: 200, json: demoPlayerKills(shown.steamId, days, Date.now()) } : get(`admin/kills?days=${days}&player=${shown.steamId}`),
      recordCall,
    ]);
    if (mine !== historyGeneration || killsAnswer.status === 401) return;
    if (recordAnswer) {
      historyRecord = recordAnswer.ok
        ? { steamId: shown.steamId, reply: recordAnswer.json }
        : { steamId: shown.steamId, error: recordAnswer.json?.error ?? 'Couldn’t load their record just now.' };
    }
    if (killsAnswer.status === 404) {
      killsStatus('The bot does not have the kill feed for staff yet. Deploy the latest bot.');
    } else if (!killsAnswer.ok) {
      throw new Error(killsAnswer.json?.error ?? `HTTP ${killsAnswer.status}`);
    } else {
      historyKills = killsAnswer.json;
      if (historyPlayer?.steamId === shown.steamId) historyPlayer = { steamId: shown.steamId, name: historyKills.player.name };
    }
    showKills();
  } catch (error) {
    if (mine !== historyGeneration) return;
    console.error('Could not load the player’s history', error);
    $('history-loading').textContent = 'Couldn’t load their kills. Trying again in a minute.';
  }
};

// The History tab's search: everyone the bot's suggestions know (in game, seen in the last 30 days, banned or with
// VIP), as the admin tools' player pick-lists do. A Steam ID can always be opened, known or not.
const SEARCH_DELAY_MS = 250;
let searchTimer = 0;
let searchGeneration = 0;

const searchPlayers = async (typed) => {
  const mine = ++searchGeneration;
  const query = typed.trim();
  const results = $('history-results');
  if (query === '') {
    results.replaceChildren();
    setStatus($('history-search-note'), 'Or click any player’s name on this page.');
    return;
  }
  const direct = /^\d{17}$/.test(query) ? [{ name: `Steam ID ${query}`, value: query }] : [];
  try {
    const { ok, json } = await call('admin/suggest', { name: 'player', options: { player: query }, focused: 'player' });
    if (mine !== searchGeneration) return;
    const choices = [...(ok ? (json?.choices ?? []) : []).filter((c) => c.value !== query), ...direct];
    setStatus($('history-search-note'), choices.length === 0 ? `Nobody the bot knows matches “${query}”.` : `${plural(choices.length, 'player')} found.`);
    results.replaceChildren(
      ...choices.map((c) =>
        el('button', {
          type: 'button',
          className: 'btn btn-ghost btn-small history-result',
          textContent: c.name,
          onclick: () => openHistory({ steamId: c.value, name: c.name.split(' · ')[0] }),
        }),
      ),
    );
  } catch (error) {
    if (mine !== searchGeneration) return;
    console.error('Could not search for players', error);
    setStatus($('history-search-note'), 'Couldn’t reach the bot. Try again in a minute.');
  }
};

// Opens the History tab's search with something typed, such as a name nobody in game has.
const findPlayer = (query) => {
  historyPlayer = null;
  selectTab('history');
  $('history-search').value = query;
  searchPlayers(query);
  $('history-search').focus();
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
  $('count-live').textContent = overview.online ? String(players.length) : '–';
  renderReviewCounts();
  $('tile-ingame').textContent = overview.online ? String(players.length) : '–';
  $('tile-ingame-note').textContent = overview.server ? `of ${overview.server.maxPlayers} slots` : '';
  $('tile-watch').textContent = String(players.filter((p) => needsLook(p, today)).length);
  $('tile-headshots-ingame').textContent = String(players.filter((p) => p.headshotsToday?.flagged).length);
  $('tile-risky-ingame').textContent = overview.steam ? String(players.filter((p) => p.steam && p.steam.risk !== 'low').length) : 'Off';
  $('tile-risky').textContent = overview.steam ? String(overview.steam.high + overview.steam.medium) : 'Off';
  // How many of the alerts are for players in game now, when the server is answering.
  const inGameNote = (count) => (overview.online ? `${count} in game` : null);
  const riskyInGame = inGameNote((overview.steam?.accounts ?? []).filter((a) => onlineIds.has(a.steamId)).length);
  $('tile-risky-note').textContent = overview.steam
    ? [riskyInGame, `${overview.steam.high} high risk`].filter(Boolean).join(' · ')
    : 'Needs STEAM_API_KEY';
  $('tile-flagged').textContent = String(overview.totals.flaggedPlayers);
  $('tile-flagged-note').textContent = inGameNote(overview.players.filter((p) => p.flags.length > 0 && onlineIds.has(p.steamId)).length) ?? '';
  $('tile-teamkills').textContent = String(overview.totals.teamKills);
  $('tile-teamkills-note').textContent = [
    overview.totals.vehicleTeamKills > 0 ? `${overview.totals.vehicleTeamKills} with a vehicle` : null,
    overview.totals.crashTeamKills > 0 ? `${overview.totals.crashTeamKills} in a helicopter crash` : null,
    plural(overview.totals.vehicleSuicides, 'vehicle suicide'),
  ]
    .filter(Boolean)
    .join(' · ');
  renderServer(overview);
  renderPlayers(overview);
  renderJoins(overview);
  renderGriefers(overview);
  renderIncidents(overview);
  renderSteam(overview);
  renderModeration(overview);
  renderBans(overview);
  renderReserved(overview);
  renderStaffSteam(overview);
  if (tab === 'history') renderHistory();
  if (overview.staffProfiles !== undefined && !mine && !askedThisSignIn()) {
    noteAsked();
    openSteam();
  }
  if (!tools.ready) loadCommands();
  if (tab === 'rotations') rotations.ensure();
  if (tab === 'lines') lines.ensure();
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

const lines = createLines({
  root: $('lines'),
  load: () => (demo ? demoLines() : get('admin/lines')),
  send: (body) => (demo ? demoLinesChange(body) : call('admin/lines', body)),
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
    loadKills();
    if (tab === 'history') loadHistory();
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
    loadKills();
    if (tab === 'history') loadHistory();
    connectFeed();
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
$('player-sort').value = filters.sort;
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

// "Only headshots" and "Only team kills" on the kill feed, "Only headshots" on a player's kills, and the History tab's
// search.
$('feed-headshots').addEventListener('change', (event) => {
  killFilters.feed.headshots = event.target.checked;
  renderFeed();
});
$('feed-teamkills').addEventListener('change', (event) => {
  killFilters.feed.teamKills = event.target.checked;
  renderFeed();
});
$('history-headshots').addEventListener('change', (event) => {
  killFilters.history = event.target.checked;
  if (historyLoaded()) renderHistoryList();
});
$('headshots-ordinary').addEventListener('change', (event) => {
  showOrdinary = event.target.checked;
  if (kills !== null) renderHeadshots();
});
$('history-search').addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchPlayers(event.target.value), SEARCH_DELAY_MS);
});

// Only refresh while someone is looking; catch up straight away when they come back, or when nothing has loaded yet.
// The live kill feed closes too while nobody is looking, and opens again with the latest kills.
document.addEventListener('visibilitychange', () => {
  if (demo || !configured || !loadToken()) return;
  if (document.hidden) {
    clearTimeout(timer);
    disconnectFeed();
    return;
  }
  connectFeed();
  if (!data || Date.now() - lastLoad >= REFRESH_MS) load();
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
  // A link to a tab or a player's kills, or back and forward between them.
  if (isTabHash(location.hash)) {
    route();
    return;
  }
  if (!demo && configured) arrive();
});

// Read before the tab is picked, as picking one tidies the # away.
const returned = signInResult(location.hash);
route();

if (demo) {
  showNotice('Showing sample data, not the real server. ', link(thisPage((p) => p.delete('demo')), 'Sign in for the real page'));
  startDemoFeed();
  load();
} else if (!configured) {
  showNotice('Live stats are not connected yet. ', link(thisPage((p) => p.set('demo', '')), 'Preview with sample data'));
} else {
  arrive(returned);
}
