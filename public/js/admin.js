import { demoFeedKill, demoKills, demoPlayerKills, demoPlayerRecord } from './demo.js';
import {
  accountAge,
  actedText,
  alertCount,
  BUTTON_BACKGROUND,
  checkedText,
  checkHolds,
  checkOf,
  clockHour,
  dealtOf,
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
  lookFirst,
  lookNow,
  luckOdds,
  metres,
  modActionCounts,
  modActionLabel,
  oddsKind,
  ordinaryHeadshots,
  percent,
  PLAYER_SORTS,
  plural,
  QUEUE_VIEWS,
  reasonFor,
  recentPlayers,
  routeHash,
  SECTIONS,
  staffRoute,
  recentActions,
  RISK_LABELS,
  sideColours,
  sideKey,
  staffBy,
  steamFlagLabel,
  steamFlagRule,
  steamWhy,
  teamCounts,
  timeAgo,
  usualHeadshots,
  utcDay,
  watchList,
  WEAPON_KINDS,
  withVehicle,
} from './format.js';
import { demo, keepQuery, showNotice } from './live.js';
import {
  $,
  badge,
  botUrl,
  call,
  cell,
  configured,
  get,
  load,
  loadCommands,
  loadToken,
  number,
  replaceButtons,
  setStatus,
  showAccount,
  showTab,
  staffCell,
  staffNames,
  start,
  steamLink,
  swatch,
  table,
  tabKeys,
  teamOf,
  when,
} from './staff.js';
import { createPalette, matches } from './palette.js';
import { createQueue } from './queue.js';
import { recordNodes } from './record.js';
import { createServer } from './server.js';
import { createTools, replyNodes } from './tools.js';
import { el, mapTag, playerHref } from './views.js';

// The staff page, in four sections. Now: the server now, everyone in game with those worth a look always at the top, to
// search and act on without leaving the page, every kill as it happens, and who joined and left. Queue: what the bot
// flagged by itself, one row per player with every reason (see queue.js), the lists by flag (far more headshots than a
// player's weapons usually get, risky Steam accounts, possible griefers), their team kills and vehicle suicides, and
// the moderation log of what staff did. Players: any player's record, kills and headshots, and team kills, starting
// from those staff acted on and who was on lately. Server: the bans and VIP, rotations, lines and weapon rules (see
// server.js). Every staff command from Discord is in the command search (Ctrl K, see palette.js), and the server's own
// in the Server menu, each opening its form over the page (see tools.js). Any player's name opens their panel at the side of the page: what is worth knowing, the buttons to act
// with the form for each (Warn, Kick, Ban, Move), their record, staff actions and latest kills. Act on a player, and the
// quick buttons on the server list, open it with that form ready. Keyboard shortcuts are at the end (? lists them).
// Signing in, the Steam account and loading are in staff.js.

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

// A choice kept for this browser when storage is on, such as alerts.
const loadPref = (key) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};
const savePref = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Kept until the page is closed.
  }
};
const ALERTS_KEY = 'gaminginit-look-alerts';

let period = 7;
let data = null;
// The section shown (see SECTIONS), and the Queue's view, which the address keeps after the # (see staffRoute).
let tab = 'now';
let queueView = 'flagged';
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
// The headshots list for the period (GET /api/admin/kills), loaded with each refresh, and the kill feed: the server's
// latest kills, newest first, which the bot sends as they come in (see connectFeed).
let kills = null;
let feed = [];
let killsGeneration = 0;
// The player on the History tab ({ steamId, name }), which the address keeps as #history/<Steam ID>, so Back goes back:
// their kills (GET /api/admin/kills?player=) and their record ({ steamId, reply }: the /player command's reply, as Look
// up shows it, or { steamId, error }). Each load has its own generation, as the overview's loads do.
let historyPlayer = null;
let historyKills = null;
let historyRecord = null;
let historyGeneration = 0;
// New kills or history that came while an Act menu was open, as for `waiting`.
let killsWaiting = false;
// "Only headshots", "Only team kills" and only one player ({ steamId, name }, or null for everyone) on the kill feed,
// and "Only headshots" on a player's kills.
const killFilters = { feed: { headshots: false, teamKills: false, player: null }, history: false };
// "Show ordinary players" on the Review tab's headshots: off, those whose headshots are ordinary and who have no flagged
// day are left out.
let showOrdinary = false;

// Forgets what the page had when staff sign out, or their sign-in runs out.
const signedOut = () => {
  data = null;
  disconnectFeed();
  killsGeneration += 1;
  historyGeneration += 1;
  kills = null;
  historyKills = null;
  historyRecord = null;
  if ($('keys').open) $('keys').close();
  if (commandDialog.open) commandDialog.close();
  if ($('palette').open) $('palette').close();
  records.clear();
  server.signedOut();
  if (peekDialog.open) peekDialog.close();
  lookSince.clear();
  lookKnown = false;
  document.title = BASE_TITLE;
};

// A player's name, opening their panel, with their Steam ID linking to their Steam profile.
const who = (player) =>
  el(
    'span',
    { className: 'staff-player' },
    el('button', { type: 'button', className: 'link-button player-name', textContent: player.name, title: `Steam ID ${player.steamId}`, onclick: () => peek(player) }),
    steamLink(player.steamId),
  );

// What the address keeps after the # for the section shown, its view, and on Players the player shown.
const tabHash = () =>
  routeHash({ section: tab, view: tab === 'queue' ? queueView : tab === 'server' ? server.view : null, steamId: tab === 'players' ? (historyPlayer?.steamId ?? null) : null });
const keepHash = () => {
  const hash = tabHash();
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
};

const selectTab = (name, { focus = false } = {}) => {
  tab = SECTIONS.includes(name) ? name : 'now';
  showTab(SECTIONS, tab, { focus });
  keepHash();
  // A player's history is drawn straight away with what the page knows, and loaded when it is not yet.
  if (tab === 'players' && data) {
    renderHistory();
    if (historyPlayer !== null && !historyLoaded()) loadHistory();
  }
  // The Server view shown loads its editor the first time.
  if (tab === 'server') server.show(server.view);
};

const isTabHash = (hash) => staffRoute(hash) !== null;

// The best name the page has for a Steam ID, until the bot sends theirs.
const knownName = (steamId) =>
  [
    ...(kills?.players ?? []),
    ...feed.flatMap((k) => [k.killer, k.victim]),
    ...(historyKills ? [historyKills.player] : []),
    ...(data?.online?.players ?? []),
  ].find((p) => p.steamId === steamId)?.name ?? steamId;

// Shows the section, view and player the address names, old links included (see staffRoute). An old link to the
// Commands tab opens the command search.
const route = () => {
  const asked = staffRoute(location.hash);
  if (asked === null) return;
  if (asked.section === 'players') historyPlayer = asked.steamId === null ? null : { steamId: asked.steamId, name: knownName(asked.steamId) };
  if (asked.section === 'queue') showQueueView(asked.view);
  if (asked.section === 'server') server.show(asked.view);
  selectTab(asked.section);
  if (asked.search) palette.open();
};

// Goes to a player's history, from their panel, a row's Act menu or Players. Back comes back.
const openHistory = (player) => {
  historyPlayer = { steamId: player.steamId, name: player.name };
  const hash = `#players/${player.steamId}`;
  if (location.hash !== hash) history.pushState({ player: player.steamId }, '', location.pathname + location.search + hash);
  closeMenus();
  if (peekDialog.open) peekDialog.close();
  selectTab('players');
  $('history-player').scrollIntoView({ block: 'start' });
};

// The Queue's views: Flagged players, By flag, Team kills and the Moderation log.
const showQueueView = (view) => {
  queueView = QUEUE_VIEWS.includes(view) ? view : QUEUE_VIEWS[0];
  for (const b of $('queue-views').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === queueView));
  for (const v of QUEUE_VIEWS) $(`queue-${v}`).hidden = v !== queueView;
  if (tab === 'queue') keepHash();
};
for (const b of $('queue-views').querySelectorAll('button')) b.addEventListener('click', () => showQueueView(b.dataset.view));

// Act: the player's panel, with the form for the tool picked (see openAct).
const act = (key, player) => {
  peek(player);
  openAct(key);
};

// A staff command, from the command search or the Server menu: every command from Discord, to pick, fill in and run, in
// a dialog over the page. A command asked for before the bot's commands have loaded opens when they come.
const commandDialog = $('command-dialog');
const COMMAND_NOTE = $('command-note').textContent;
const commands = createTools({ root: $('command-tools'), call, onChanged: () => load(), staff: staffNames, teamOf });
let commandWaiting = null;
let commandMissing = null;
const openCommand = (key) => {
  closeMenus();
  if (!commandDialog.open) commandDialog.showModal();
  if (commands.ready) {
    setStatus($('command-note'), COMMAND_NOTE);
    commands.open(key);
  } else {
    commandWaiting = key;
    setStatus($('command-note'), commandMissing ?? 'Loading the staff commands…');
  }
};
$('command-close').addEventListener('click', () => commandDialog.close());

// The Server menu in the staff bar: the commands for the whole server, and the rotations.
const SERVER_COMMANDS = ['broadcast', 'setnextmap', 'changemap', 'seednow'];
const serverMenu = () => {
  const item = (text, run) => el('button', { type: 'button', className: 'account-item', textContent: text, onclick: () => ((($('server-menu').open = false), run())) });
  $('server-menu-list').replaceChildren(
    ...commands.list.filter((t) => SERVER_COMMANDS.includes(t.key)).map((t) => item(t.label, () => openCommand(t.key))),
    item('Map rotations', () => {
      server.show('rotations');
      selectTab('server');
    }),
  );
};

// The bot's commands have come: the Server menu has them, and a command asked for meanwhile opens.
const commandsReady = () => {
  serverMenu();
  const asked = commandWaiting;
  commandWaiting = null;
  if (asked && commandDialog.open) openCommand(asked);
};

// What staff can do to a player from a row. Warnings, kicks and team moves only work on someone in game. History and the
// kill feed are not admin tools: they open the History tab, and show only that player in the kill feed.
const ACTIONS = [
  { key: 'history', label: 'History', note: 'Kills and headshots, team kills, Steam account, bans and staff history', inGame: false },
  { key: 'feed', label: 'Only them in the kill feed', note: 'Their kills and deaths, as they happen', inGame: false },
  { key: 'warn', label: 'Warn', note: 'A private message in game', inGame: true },
  { key: 'kick', label: 'Kick', note: 'They see the reason, and can rejoin', inGame: true },
  { key: 'switchteam', label: 'Move to another team', note: 'They respawn on the new side', inGame: true },
  { key: 'ban', label: 'Ban', note: 'For a set time or for good', inGame: false },
  { key: 'private:add', label: 'Make profile private', note: 'Shown as [private profile] on the website and in public posts', inGame: false },
];

// "Checked, they're fine", for a player worth a look in game, or taking it back. Only with a bot that keeps checks: it
// sends `checked` with each player in game.
const CHECK_ACTIONS = {
  check: { label: 'Checked, they’re fine', note: 'Moves them out of Worth a look now for all staff, until more comes up today' },
  uncheck: { label: 'Take back the check', note: 'Puts them back in Worth a look now' },
};
const checkAction = (player) =>
  player.checked === undefined || !onlineIds.has(player.steamId) ? null : lookNow(player) ? 'check' : checkHolds(player) ? 'uncheck' : null;

// Does what a menu item or button picked, for `player`.
const runAction = (key, player) => {
  if (key === 'history') openHistory(player);
  else if (key === 'feed') watchFeed(player);
  else if (key === 'check' || key === 'uncheck') checkPlayer(player, key === 'check');
  else act(key, player);
};

// Saves a mark for all staff (a check, or a dealt with), and loads the page again to show it. Resolves to whether it was
// saved.
const saveMark = async (path, body) => {
  try {
    const { ok, json } = await call(path, body);
    if (!ok) {
      if (demo || loadToken()) showNotice(json?.error ?? 'Couldn’t save that just now. Try again in a minute.');
      return false;
    }
    load();
    return true;
  } catch (error) {
    console.error(`Could not save ${path}`, error);
    showNotice('Couldn’t reach the bot. Try again in a minute.');
    return false;
  }
};

// Notes a "Checked, they're fine", or takes one back.
const checkPlayer = (player, on) =>
  saveMark('admin/check', on ? { action: 'check', steamId: player.steamId, ...checkOf(player) } : { action: 'uncheck', steamId: player.steamId });

// Notes a "Dealt with" on a Queue row, or undoes it (see queue.js).
const dealWith = (row, on, outcome = '') =>
  saveMark('admin/dealt', on ? { action: 'deal', steamId: row.steamId, ...dealtOf(row), ...(outcome ? { outcome } : {}) } : { action: 'undo', steamId: row.steamId });

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
    ...[...ACTIONS.filter((a) => inGame || !a.inGame), ...(checkAction(player) ? [{ key: checkAction(player), ...CHECK_ACTIONS[checkAction(player)] }] : [])].map((a) =>
      el(
        'button',
        {
          type: 'button',
          className: 'act-item',
          onclick: () => {
            menu.open = false;
            runAction(a.key, player);
          },
        },
        el('span', { className: 'act-label', textContent: a.label }),
        el('span', { className: 'act-note', textContent: a.note }),
      ),
    ),
    inGame ? null : el('p', { className: 'act-note act-off', textContent: 'Not in game, so they can’t be warned, kicked or moved.' }),
  );
  const menu = el('details', { className: 'act-menu' }, el('summary', { className: 'btn btn-ghost btn-small', textContent: 'Act' }), list);
  menu.dataset.steamId = player.steamId;
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

const renderGriefers = (overview) => {
  const marks = overview.flags;
  $('flag-rules').replaceChildren(
    ...Object.keys(marks).map((flag) =>
      el('li', {}, badge(flagLabel(flag), FLAG_KIND[flag]), ` ${flagRule(flag, marks, overview.totals.crashTeamKills !== undefined)}`),
    ),
  );
  // What the list is, and the marks, are behind its "?"; only a reason it is empty shows.
  $('griefers-note').textContent = overview.feedSince
    ? ''
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
                showQueueView('teamkills');
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

// The server list's columns: kills and deaths this match, and time on the server today. Each player's team is under
// their name.
const PLAYER_HEADERS = ['Player', ['K / D', 'num'], ['Today', 'num'], 'Worth knowing', ''];

// How long a player newly worth a look is marked "Just flagged".
const JUST_FLAGGED_MS = 5 * 60_000;

const badgeOf = (w) => {
  const b = badge(w.text, w.kind);
  if (w.title) b.title = w.title;
  return b;
};

// What is worth knowing about a player in game: their flags and the rest (see watchList), "Just flagged" when they
// became worth a look since the page loaded, any "Checked, they're fine" today, and what staff did to them in the last
// day (`acted`, from recentActions).
const worthKnowing = (p, overview, acted) => {
  const now = overview.generatedAt;
  const since = lookSince.get(p.steamId);
  const marks = [
    ...(since && now - since < JUST_FLAGGED_MS ? [{ text: 'Just flagged', kind: 'accent', title: `Worth a look since ${when.format(since)}` }] : []),
    ...watchList(p, utcDay(now)),
  ];
  const did = acted.get(p.steamId);
  const holds = checkHolds(p);
  return [
    marks.length === 0 ? null : el('span', { className: 'badges' }, ...marks.map(badgeOf)),
    p.checked
      ? el('p', {
          className: `row-note${holds ? ' row-checked' : ''}`,
          textContent: holds ? `✓ ${checkedText(p.checked, now, overview.staff)}` : `${checkedText(p.checked, now, overview.staff)}, but more came up since`,
        })
      : null,
    did ? el('p', { className: 'row-note', textContent: actedText(did, now, overview.staff) }) : null,
  ].filter(Boolean);
};

// One click to warn, kick or ban a player worth a look, or to say they're fine once checked (✓, named in full for
// screen readers and on hover). `check` false leaves out the ✓, as on the Queue, which has Dealt with in its place.
const QUICK = { warn: ['Warn'], kick: ['Kick'], ban: ['Ban'], check: ['✓', 'Checked, they’re fine'] };
const quickActs = (p, { check = true } = {}) =>
  el(
    'span',
    { className: 'quick-acts' },
    ...['warn', 'kick', 'ban', ...(check && checkAction(p) === 'check' ? ['check'] : [])].map((key) => {
      const [text, name] = QUICK[key];
      const b = el('button', { type: 'button', className: `btn btn-ghost btn-small quick-${key}`, textContent: text, onclick: () => runAction(key, p) });
      if (name) {
        b.title = name;
        b.setAttribute('aria-label', `${name}: ${p.name}`);
      } else b.setAttribute('aria-label', `${text} ${p.name}`);
      b.dataset.quick = key;
      return b;
    }),
  );

// Everyone in game, as staff searched, filtered and sorted it, in two parts: those worth a look now first, whatever the
// order, so a flagged player is never down the list; then everyone else. Each part is in the order picked.
const renderPlayers = (overview) => {
  if (!overview) return;
  const online = overview.online;
  const players = online?.players ?? [];
  const colours = sideColours([{ factionScores: overview.server?.factionScores ?? [] }]);
  renderTeamFilter(players, overview.server?.factionScores ?? []);
  const shown = filterPlayers(players, filters);
  const query = filters.query.trim();
  // Said only while a search, team or "Only worth a look" leaves some out: the tab and each part give the counts.
  setStatus($('players-count'), online === null || shown.length === players.length ? '' : `Showing ${shown.length} of ${players.length} in game`);
  // On a phone each cell says what it is, as the table's headings are hidden there.
  const labelled = (label, td) => {
    td.dataset.label = label;
    return td;
  };
  const acted = recentActions(overview.moderation, overview.generatedAt);
  // Those worth a look have their quick buttons by Act.
  const row = (p, quick) => {
    const knowing = worthKnowing(p, overview, acted);
    const tr = el(
      'tr',
      { className: lookNow(p) ? 'watch' : '' },
      el(
        'td',
        { className: 'player' },
        who(p),
        el('span', { className: 'player-team' }, ...(p.faction === null ? ['No team'] : [swatch(colours.get(sideKey(p.faction)) ?? null), ` ${p.faction}`])),
      ),
      labelled('Kills / deaths', el('td', { className: 'num', textContent: p.kills === null ? '–' : `${p.kills} / ${p.deaths ?? 0}` })),
      labelled('Today', el('td', { className: 'num', textContent: p.minutesToday > 0 ? formatHours(p.minutesToday) : '–' })),
      knowing.length === 0 && !quick
        ? el('td', { className: 'no-watch' }, el('span', { className: 'muted', textContent: '–' }))
        : el('td', { className: 'knowing' }, ...knowing),
      el('td', { className: 'row-actions' }, quick ? quickActs(p) : null, actMenu(p)),
    );
    tr.dataset.steamId = p.steamId;
    return tr;
  };
  const node = $('server-players');
  // A message in place of the list, such as when nobody is in game.
  const instead = (...content) => node.replaceChildren(el('p', { className: 'muted list-instead' }, ...content));
  if (online === null) {
    instead('The server isn’t answering, so there is no list. It comes back with the server.');
    return;
  }
  if (players.length === 0) {
    instead('Nobody is in game.');
    return;
  }
  if (shown.length === 0 && query !== '') {
    instead(
      `Nobody in game matches “${query}”. `,
      el('button', {
        type: 'button',
        className: 'link-button',
        textContent: `Find “${query}” among everyone the bot knows`,
        onclick: () => findPlayer(query),
      }),
    );
    return;
  }
  const { look, rest } = lookFirst(shown);
  const narrowed = shown.length < players.length;
  const part = (id, title, list, alert, empty) => {
    const t = el('table', { className: `admin-table server-table${alert ? ' look-table' : ''}` });
    t.setAttribute('aria-labelledby', id);
    table(t, PLAYER_HEADERS, list.map((p) => row(p, alert)), empty);
    return el(
      'section',
      { className: `alert-group${alert ? ' look-group' : ''}` },
      el(
        'h3',
        { className: 'group-title', id },
        title,
        el('span', { className: `tab-count${alert && list.length > 0 ? ' tab-count-alert' : ''}`, textContent: String(list.length) }),
      ),
      el('div', { className: 'admin-scroll' }, t),
    );
  };
  node.replaceChildren(
    part('players-look', 'Worth a look now', look, true, narrowed ? 'Nobody worth a look matches.' : 'Nobody in game is worth a look right now.'),
    // "Only players worth a look" leaves the rest out.
    filters.watch ? null : part('players-rest', 'Everyone else', rest, false, narrowed ? 'Nobody else matches. Try another team, or clear the search.' : 'Everyone in game is worth a look.'),
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
  $('incidents-note').textContent = focused === null ? '' : `Involving ${focused.name}, newest first.`;
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
    $('steam-help-note').textContent = '';
    $('steam-rules').replaceChildren();
    $('steam-accounts').replaceChildren();
    return;
  }
  const now = overview.generatedAt;
  $('steam-note').textContent = `Checked ${steam.checked} of the ${steam.players} players seen in this period or in game now: ${steam.high} high risk and ${steam.medium} worth a look.`;
  $('steam-help-note').textContent =
    `Riskiest first. High risk is ${points(steam.risk.high)} or more, worth a look ${steam.risk.medium} or more. ` +
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

// A kill's weapon, what sort it is when not carried by hand, what the game said about it, and whether it was a
// headshot or a team kill; then how far, and where.
const killCells = (k, above) => [
  cell(
    k.weapon,
    WEAPON_KINDS[k.weaponKind] ? el('span', { className: 'kill-distance', textContent: ` · ${WEAPON_KINDS[k.weaponKind]}` }) : null,
    ...k.tags.filter((t) => DEATH_TAGS[t] && t !== 'Suicide').map((t) => el('span', { className: 'kill-distance', textContent: ` · ${DEATH_TAGS[t]}` })),
    k.headshot || k.teamKill || k.weaponNamed === false
      ? el(
          'span',
          { className: 'badges' },
          k.headshot ? badge('Headshot', 'accent') : null,
          k.teamKill ? badge('Team kill', 'bad') : null,
          // Older bots don't say, so only a weapon the bot says it has no name for is marked.
          k.weaponNamed === false ? uncheckedName() : null,
        )
      : null,
  ),
  el('td', { className: 'num', textContent: k.distance === null ? '–' : metres(k.distance) }),
  killMap(k, above),
];

// The kill feed shows the latest kills, up to as many as the bot keeps.
const FEED_SHOWN = 250;
const FEED_HEADERS = ['When', 'Killer', 'Killed', 'With', ['Distance', 'num'], 'Map'];
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

// The kill feed's filters as feedKillShown and feedEmpty take them.
const feedFilters = () => {
  const { player, ...rest } = killFilters.feed;
  return { ...rest, player: player?.steamId ?? null, playerName: player?.name ?? '' };
};
const feedShown = (k) => feedKillShown(k, feedFilters());

const feedNote = () =>
  setStatus(
    $('feed-note'),
    `The server’s latest ${feed.length} kills, newest first${socketState === 'live' || socketState === 'sample' ? ', as they happen' : ''}. Click a name for a quick look at them.`,
  );

// Which one player the kill feed shows, when only one.
const renderFeedPlayer = () => {
  const only = killFilters.feed.player;
  $('feed-player').hidden = only === null;
  if (only === null) return;
  $('feed-player').replaceChildren(
    badge('Only one player', 'accent'),
    ` ${only.name}’s kills and deaths. `,
    el('button', { type: 'button', className: 'link-button', textContent: 'Show everyone', onclick: () => watchFeed(null) }),
  );
};

const renderFeed = () => {
  feedNote();
  renderFeedPlayer();
  const shown = feed.filter(feedShown);
  table($('kill-feed'), FEED_HEADERS, shown.map((k, i) => feedRow(k, shown[i - 1])), feedEmpty(feed.length, feedFilters()));
};

// Shows only one player's kills and deaths in the kill feed (null for everyone), such as someone others say is team
// killing, and brings the feed into view.
const watchFeed = (player) => {
  killFilters.feed.player = player === null ? null : { steamId: player.steamId, name: player.name };
  if (peekDialog.open) peekDialog.close();
  if (tab !== 'now') selectTab('now');
  renderFeed();
  if (player !== null) $('feed-card').scrollIntoView({ block: 'nearest' });
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
  if (peekDialog.open && added.some((k) => k.killer.steamId === peekPlayer?.steamId || k.victim.steamId === peekPlayer?.steamId)) renderPeek();
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
  // What the list is is behind its "?".
  $('headshots-note').textContent = kills.since
    ? `${totals.kills.toLocaleString('en-GB')} kills in this period, ${percent(totals.kills > 0 ? totals.headshots / totals.kills : null)} of them headshots.`
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

// The Queue: its list of flagged players, its counts, and the headshot tile, which need the headshots list as well as
// the overview.
const renderReviewCounts = () => {
  if (!data) return;
  const flagged = kills?.totals.flaggedPlayers ?? 0;
  const online = new Map((data.online?.players ?? []).map((p) => [p.steamId, p]));
  const count = queue.render({ overview: data, kills, online, now: data.generatedAt });
  $('count-queue').textContent = String(count);
  $('count-queue').classList.toggle('tab-count-alert', count > 0);
  $('count-flagged').textContent = String(count);
  $('count-teamkills').textContent = String(data.incidents.length);
  $('count-log').textContent = String(data.moderation.length);
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
  if (tab === 'players') renderHistory();
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
    ['When', 'Killed', 'With', ['Distance', 'num'], 'Map'],
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
  renderRecent();
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
  $('history-record').replaceChildren(...recordView(historyRecord?.steamId === steamId ? historyRecord : null));
  renderHistorySessions();
  renderHistoryKills();
  renderHistoryGrief(steamId);
};

// A player's record from the bot, as facts (GET /api/admin/player): { record }. An older bot has only its /player reply,
// as Discord shows it: { reply }. { error } when it could not be loaded.
const fetchRecord = async (steamId) => {
  const failed = (answer) => ({ error: answer.json?.error ?? 'Couldn’t load their record just now.' });
  try {
    if (demo) return { record: demoPlayerRecord(steamId, Date.now()) };
    const answer = await get(`admin/player?player=${steamId}`);
    if (answer.ok) return { record: answer.json };
    if (answer.status !== 404) return failed(answer);
    const reply = await call('admin/command', { name: 'player', options: { player: steamId } });
    return reply.ok ? { reply: reply.json } : failed(reply);
  } catch (error) {
    console.error('Could not load the player’s record', error);
    return { error: 'Couldn’t reach the bot. Try again in a minute.' };
  }
};

// A record as loaded (see fetchRecord), or that it is loading.
const recordView = (loaded) => {
  const staff = data?.staff ?? {};
  if (!loaded) return [el('p', { className: 'muted', textContent: 'Loading their record…' })];
  if (loaded.record) return recordNodes(loaded.record, { staff, now: data?.generatedAt ?? Date.now() });
  if (loaded.reply) return replyNodes(loaded.reply, staff);
  return [el('p', { className: 'tool-error', textContent: loaded.error })];
};

// Their kills for the period, with each refresh while History is open, and their record once each time they are opened.
const loadHistory = async () => {
  if (historyPlayer === null) return;
  const mine = ++historyGeneration;
  const shown = historyPlayer;
  const days = period;
  const wantRecord = historyRecord?.steamId !== shown.steamId;
  try {
    const [killsAnswer, recordAnswer] = await Promise.all([
      demo ? { ok: true, status: 200, json: demoPlayerKills(shown.steamId, days, Date.now()) } : get(`admin/kills?days=${days}&player=${shown.steamId}`),
      wantRecord ? fetchRecord(shown.steamId) : null,
    ]);
    if (mine !== historyGeneration || killsAnswer.status === 401) return;
    if (recordAnswer) historyRecord = { steamId: shown.steamId, ...recordAnswer };
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
  selectTab('players');
  $('history-search').value = query;
  renderRecent();
  searchPlayers(query);
  $('history-search').focus();
};

// A player's panel, from their name anywhere on the page: what is worth knowing about them now, the buttons to act and
// the form for each, their numbers, record, what staff did and their latest kills and deaths in the kill feed, without
// leaving the tab. Drawn again with each refresh and each kill of theirs while open; the form and the record are kept
// through a redraw.
const peekDialog = $('peek');
// The player shown ({ steamId, name }), and the name staff clicked, to go back to.
let peekPlayer = null;
let peekFrom = null;
// How many of the player's latest kills and deaths, and staff actions, it shows.
const PEEK_KILLS = 8;
const PEEK_ACTIONS = 5;

// The forms to act on the panel's player: the bot's tools that take a player, with them picked (see tools.js). After
// one that changes something, their record is loaded again, and the page.
const panelTools = createTools({
  root: $('peek-act-tools'),
  idPrefix: 'peek-tool',
  call,
  onChanged: () => {
    if (peekPlayer) records.delete(peekPlayer.steamId);
    if ($('peek-record').open) loadRecord();
    load();
  },
  staff: staffNames,
  teamOf,
  forPlayer: true,
  only: (tool) => tool.options.some((o) => o.name === 'player' || o.name === 'steam_id'),
});
// The tool open in the panel ('ban'), or null; one asked for before the tools had loaded; and why there are no tools,
// when the bot has none.
let actKey = null;
let actWaiting = null;
let actMissing = null;

// Opens a tool's form in the panel for its player, such as Ban, starting the reason from what they did today (see
// reasonFor). Until the tools have loaded, the panel says so and opens it when they come.
const openAct = (key) => {
  if (peekPlayer === null) return;
  actKey = key;
  $('peek-act').hidden = false;
  if (!panelTools.ready) {
    actWaiting = key;
    setStatus($('peek-act-note'), actMissing ?? 'Loading the admin tools…');
  } else {
    setStatus($('peek-act-note'), '');
    const online = data?.online?.players.find((p) => p.steamId === peekPlayer.steamId) ?? null;
    panelTools.use(key, peekPlayer.steamId, peekPlayer.name, { reason: reasonFor(online) });
  }
  renderPeek();
  $('peek-act').scrollIntoView({ block: 'nearest' });
};

// The tools have loaded: a form asked for meanwhile opens now, if the panel is still open.
const actReady = () => {
  const asked = actWaiting;
  actWaiting = null;
  if (asked && peekDialog.open) openAct(asked);
};

const closeAct = () => {
  actKey = null;
  actWaiting = null;
  $('peek-act').hidden = true;
};

// Each player's record as loaded this visit, by Steam ID: { record }, { reply } from an older bot, or { error }; null
// while loading.
const records = new Map();

const renderRecord = () => {
  $('peek-record-body').replaceChildren(...recordView(peekPlayer ? records.get(peekPlayer.steamId) : undefined));
};

// The panel player's record, when Record is opened: once each visit, and again after staff act on them. One that
// failed is asked for again the next time.
const loadRecord = async () => {
  if (peekPlayer === null) return;
  const { steamId } = peekPlayer;
  const kept = records.get(steamId);
  if (kept?.record || kept?.reply || kept === null) {
    renderRecord();
    return;
  }
  records.set(steamId, null);
  renderRecord();
  records.set(steamId, await fetchRecord(steamId));
  if (peekPlayer?.steamId === steamId) renderRecord();
};
$('peek-record').addEventListener('toggle', () => {
  if ($('peek-record').open) loadRecord();
});

const peek = (player) => {
  if (!peekDialog.open) peekFrom = document.activeElement;
  // Another player: their own panel, with no form open and Record folded.
  if (peekPlayer?.steamId !== player.steamId) {
    closeAct();
    $('peek-record').open = false;
  }
  peekPlayer = { steamId: player.steamId, name: player.name };
  closeMenus();
  renderPeek();
  if (!peekDialog.open) peekDialog.showModal();
  $('peek-close').focus();
};

const fact = (label, value) => el('div', { className: 'player-peek-fact' }, el('dt', { textContent: label }), el('dd', {}, value));

// The panel's buttons and their keys (see the keys below).
const PANEL_ACTS = [
  { key: 'warn', text: 'Warn', letter: 'W', inGame: true },
  { key: 'kick', text: 'Kick', letter: 'K', inGame: true },
  { key: 'ban', text: 'Ban', letter: 'B', inGame: false },
  { key: 'switchteam', text: 'Move team', letter: 'M', inGame: true },
  { key: 'private:add', text: 'Make profile private', letter: null, inGame: false },
];

const renderPeek = () => {
  if (peekPlayer === null) return;
  const { steamId } = peekPlayer;
  const now = data?.generatedAt ?? Date.now();
  const online = data?.online?.players.find((p) => p.steamId === steamId) ?? null;
  const player = online ?? peekPlayer;
  const ban = data?.bans?.find((b) => b.player.steamId === steamId) ?? null;
  // Keep keyboard focus on the same button through a redraw.
  const focused = $('peek-top').contains(document.activeElement) || $('peek-body').contains(document.activeElement) ? document.activeElement.dataset.peek : undefined;
  $('peek-title').textContent = player.name;
  const button = (key, text, run, { kind = '', letter = null, pressed = null } = {}) => {
    const b = el('button', { type: 'button', className: `btn btn-ghost btn-small${kind ? ` ${kind}` : ''}`, textContent: text, onclick: run });
    if (letter) {
      b.title = `${text} (${letter})`;
      b.setAttribute('aria-keyshortcuts', letter);
    }
    if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
    b.dataset.peek = key;
    return b;
  };
  const check = checkAction(player);
  const actions = [
    ...PANEL_ACTS.filter((a) => online || !a.inGame).map((a) => button(a.key, a.text, () => openAct(a.key), { letter: a.letter, pressed: actKey === a.key })),
    ...(ban ? [button('unban', 'Unban', () => openAct('unban'), { pressed: actKey === 'unban' })] : []),
    ...(check ? [button(check, CHECK_ACTIONS[check].label, () => checkPlayer(player, check === 'check'), { kind: check === 'check' ? 'quick-check' : '', letter: 'C' })] : []),
    button('feed', 'Only them in the kill feed', () => watchFeed(player)),
    button('history', 'Full history →', () => openHistory(player)),
  ];
  const theirs = feed.filter((k) => k.killer.steamId === steamId || k.victim.steamId === steamId).slice(0, PEEK_KILLS);
  const did = (data?.moderation ?? []).filter((e) => e.player.steamId === steamId).slice(0, PEEK_ACTIONS);
  const hs = online?.headshotsToday;
  // Left out when not shown: replaceChildren would write "null".
  const shown = (...nodes) => nodes.filter(Boolean);
  $('peek-top').replaceChildren(
    ...shown(
      el(
        'p',
        { className: 'player-peek-id' },
        steamLink(steamId),
        online?.id ? el('a', { className: 'player-link', href: playerHref(online.id), textContent: 'Public player page' }) : null,
      ),
      el(
        'span',
        { className: 'badges' },
        online ? badge(online.faction ? `In game · ${online.faction}` : 'In game', 'accent') : badge('Not in game'),
        ban && !online?.banned ? badge(ban.onServer ? 'Banned' : 'Ban waiting', 'bad') : null,
      ),
      ...(online && data ? worthKnowing(online, data, recentActions(data.moderation, now)) : []),
      el('div', { className: 'player-peek-actions' }, ...actions),
      online ? null : el('p', { className: 'muted player-peek-off', textContent: 'Not in game, so they can’t be warned, kicked or moved.' }),
    ),
  );
  $('peek-body').replaceChildren(
    ...shown(
      online
        ? el(
            'dl',
            { className: 'player-peek-facts' },
            fact('Kills / deaths', online.kills === null ? '–' : `${online.kills} / ${online.deaths ?? 0} this match`),
            fact('On today', online.minutesToday > 0 ? formatHours(online.minutesToday) : '–'),
            fact('Team kills today', String(online.teamKillsToday)),
            fact('Vehicle suicides today', String(online.vehicleSuicidesToday)),
            fact('Headshots today', hs ? `${hs.headshots} of ${hs.kills} kills${hs.expected === null ? '' : `, usual ${Math.round(hs.expected)}`}` : '–'),
          )
        : null,
      el('h3', { className: 'group-title', textContent: 'Staff actions' }),
      did.length === 0
        ? el('p', { className: 'muted', textContent: 'Nothing in this period.' })
        : el(
            'ul',
            { className: 'player-peek-list' },
            ...did.map((e) =>
              el(
                'li',
                {},
                badge(modActionLabel(e.action), e.action === 'ban' ? 'bad' : e.action === 'kick' ? 'hot' : ''),
                ` ${timeAgo(now - e.at)} · ${staffBy(e, data?.staff ?? {})}`,
                e.reason ? el('span', { className: 'muted', textContent: ` · ${e.reason}` }) : null,
              ),
            ),
          ),
      el('h3', { className: 'group-title', textContent: 'Kill feed' }),
      theirs.length === 0
        ? el('p', { className: 'muted', textContent: 'No kills or deaths in the kill feed.' })
        : el(
            'ul',
            { className: 'player-peek-list' },
            ...theirs.map((k) =>
              el(
                'li',
                {},
                el('time', { dateTime: new Date(k.at).toISOString(), className: 'when', textContent: timeKill.format(k.at) }),
                k.killer.steamId === steamId ? ` Killed ${k.victim.name}` : ` Killed by ${k.killer.name}`,
                el('span', { className: 'muted', textContent: ` · ${k.weapon}` }),
                k.teamKill ? badge('Team kill', 'bad') : null,
                k.headshot ? badge('Headshot', 'accent') : null,
              ),
            ),
          ),
    ),
  );
  if (focused !== undefined) peekDialog.querySelector(`[data-peek="${focused}"]`)?.focus({ preventScroll: true });
};

$('peek-close').addEventListener('click', () => peekDialog.close());
peekDialog.addEventListener('close', () => {
  if (peekFrom?.isConnected) peekFrom.focus({ preventScroll: true });
  peekFrom = null;
  peekPlayer = null;
  closeAct();
  $('peek-record').open = false;
});
// A click on the backdrop, outside the panel, closes it. The panel's own padding is the dialog too, so where the click was
// tells them apart.
peekDialog.addEventListener('click', (event) => {
  if (event.target !== peekDialog) return;
  const box = peekDialog.getBoundingClientRect();
  const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  if (!inside) peekDialog.close();
});

// Keyboard shortcuts, for staff at a desk. ? lists them (#keys). None while typing in a box, or with Ctrl, Alt or Cmd,
// and none sends anything by itself: W, K, B and M open a form, and Enter or a click sends it.
const LETTERS = { w: 'warn', k: 'kick', b: 'ban', m: 'switchteam' };

// Whether keys go to what has focus as text: a box being typed in, or a drop-down.
const typing = (node) =>
  node instanceof HTMLTextAreaElement ||
  node instanceof HTMLSelectElement ||
  Boolean(node?.isContentEditable) ||
  (node instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit', 'reset', 'hidden'].includes(node.type));

// The server list's players, by their names' buttons, in the order shown.
const listNames = () => [...$('server-players').querySelectorAll('tbody tr .player-name')];
const playerOfRow = (node) => {
  const id = node?.closest?.('#server-players tr[data-steam-id]')?.dataset.steamId;
  return id ? (data?.online?.players.find((p) => p.steamId === id) ?? null) : null;
};

// W, K, B, M or C on a player: the form in their panel, or their check.
const keyAct = (letter, player) => {
  const inGame = onlineIds.has(player.steamId);
  if (letter === 'c') {
    const check = checkAction(player);
    if (check) checkPlayer(player, check === 'check');
    return Boolean(check);
  }
  const key = LETTERS[letter];
  if (!key || (key !== 'ban' && !inGame)) return false;
  act(key, player);
  return true;
};

$('keys-close').addEventListener('click', () => $('keys').close());

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || data === null) return;
  const at = document.activeElement;
  // From the server list's search, ↓ goes to the first player.
  if (event.key === 'ArrowDown' && at === $('player-search')) {
    const first = listNames()[0];
    if (first) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (typing(at)) return;
  // Another dialog over the page, or an Act menu, has the keys.
  const other = [...document.querySelectorAll('dialog[open]')].some((d) => d !== peekDialog) || document.querySelector('.act-menu[open]');
  if (event.key === '?') {
    if (!other) {
      event.preventDefault();
      $('keys').showModal();
    }
    return;
  }
  if (other) return;
  const letter = event.key.toLowerCase();
  if (peekDialog.open) {
    // In the panel: 1 to 6 pick a ban's length, and the letters act on its player.
    if (/^[1-9]$/.test(event.key) && actKey !== null && panelTools.pick(Number(event.key))) {
      event.preventDefault();
      return;
    }
    if (peekPlayer && (LETTERS[letter] || letter === 'c')) {
      event.preventDefault();
      // The form open now stays as it is: B on the ban form does not start it again.
      if (LETTERS[letter] === actKey) return;
      keyAct(letter, data.online?.players.find((p) => p.steamId === peekPlayer.steamId) ?? peekPlayer);
    }
    return;
  }
  if (event.key === '/') {
    const search = tab === 'now' ? $('player-search') : tab === 'players' ? $('history-search') : null;
    if (search) {
      event.preventDefault();
      search.focus();
      search.select();
    }
    return;
  }
  if (tab !== 'now' || !$('server-players').contains(at)) return;
  // In the server list: ↓ and ↑ move from player to player (↑ from the first goes back to the search), and the letters
  // act on the player you are on.
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const names = listNames();
    const i = names.findIndex((n) => n.closest('tr') === at.closest('tr'));
    const next = event.key === 'ArrowDown' ? names[i + 1] : i > 0 ? names[i - 1] : $('player-search');
    if (next) {
      event.preventDefault();
      next.focus();
      next.closest('tr')?.scrollIntoView({ block: 'nearest' });
    }
    return;
  }
  const player = playerOfRow(at);
  if (player && (LETTERS[letter] || letter === 'c') && keyAct(letter, player)) event.preventDefault();
});

// Alerts: the browser tab's title says how many in game are worth a look now, and a player who becomes worth a look
// while the page is open is marked "Just flagged". With "Alert me" on, the page also beeps, shows a desktop notification
// while its tab is in the background (when the browser allows them), and keeps checking every minute while hidden.
const BASE_TITLE = document.title;
// When each player worth a look now first was, this visit; null for those who already were when the page loaded.
const lookSince = new Map();
let lookKnown = false;
let alertsOn = loadPref(ALERTS_KEY) === '1';
let audio = null;

// A short two-note chime. Browsers only play sound once staff have clicked on the page.
const chime = () => {
  if (audio === null || audio.state !== 'running') return;
  const t = audio.currentTime;
  for (const [i, frequency] of [880, 1320].entries()) {
    const start = t + i * 0.18;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    tone.connect(gain).connect(audio.destination);
    tone.start(start);
    tone.stop(start + 0.17);
  }
};

const startAudio = () => {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (Context === undefined) return;
  audio ??= new Context();
  if (audio.state === 'suspended') audio.resume().catch(() => undefined);
};

const notifications = () => (typeof Notification === 'undefined' ? 'none' : Notification.permission);

const alertsNote = () => {
  $('look-alerts').setAttribute('aria-pressed', String(alertsOn));
  $('alerts-note').hidden = !alertsOn;
  const desktop = notifications();
  setStatus(
    $('alerts-note'),
    !alertsOn
      ? ''
      : desktop === 'granted'
        ? 'Alerts on: a chime, and a desktop notification while this tab is in the background. The page keeps checking every minute while hidden.'
        : desktop === 'denied'
          ? 'Alerts on: a chime only, as this browser blocks notifications from this site. The page keeps checking every minute while hidden.'
          : 'Alerts on: a chime only. Allow notifications when the browser asks, for desktop alerts too. The page keeps checking every minute while hidden.',
  );
};

const setAlerts = async (on) => {
  alertsOn = on;
  savePref(ALERTS_KEY, on ? '1' : '');
  if (on) {
    startAudio();
    // Older browsers answer with a callback rather than a promise; either way the note reads the answer after.
    if (notifications() === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Asked again next time alerts are turned on.
      }
    }
  }
  alertsNote();
};

const alertLook = (fresh, overview) => {
  chime();
  if (!document.hidden || notifications() !== 'granted') return;
  const today = utcDay(overview.generatedAt);
  for (const p of fresh.slice(0, 3)) {
    let note;
    try {
      note = new Notification(`${p.name} is worth a look`, {
        body: watchList(p, today)
          .map((w) => w.text)
          .join(' · '),
        tag: `look-${p.steamId}`,
        icon: 'favicon.svg',
      });
    } catch (error) {
      // Some phones only show notifications from a service worker: the chime and the title still tell.
      console.error('Could not show a notification', error);
      return;
    }
    note.addEventListener('click', () => {
      window.focus();
      selectTab('now');
      peek(p);
      note.close();
    });
  }
};

// Notes who became worth a look since the last load, for the title, "Just flagged" and the alerts. While the server is
// not answering, nobody is known to be in game, so what the page had stays.
const noticeLook = (overview) => {
  if (overview.online === null) return;
  const now = overview.generatedAt;
  const looking = overview.online.players.filter(lookNow);
  const ids = new Set(looking.map((p) => p.steamId));
  for (const id of [...lookSince.keys()]) if (!ids.has(id)) lookSince.delete(id);
  const fresh = looking.filter((p) => !lookSince.has(p.steamId));
  for (const p of fresh) lookSince.set(p.steamId, lookKnown ? now : null);
  document.title = looking.length > 0 ? `(${looking.length}) ${BASE_TITLE}` : BASE_TITLE;
  if (lookKnown && fresh.length > 0 && alertsOn) alertLook(fresh, overview);
  lookKnown = true;
};

// Draws new data, or keeps it until an open Act menu closes.
const show = (overview) => {
  noticeLook(overview);
  if (document.querySelector('.act-menu[open]')) waiting = overview;
  else render(overview);
};

const render = (overview) => {
  waiting = null;
  data = overview;
  showAccount(overview);
  for (const button of document.querySelectorAll('.period button[data-days]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.days) === period));
  }
  const span = period === 1 ? 'Today' : `The last ${period} days`;
  $('period-note').textContent = overview.feedSince
    ? `${span} (UTC days). Team kills and suicides come from the kill feed, which the bot has had since ${overview.feedSince}.`
    : `${span} (UTC days).`;
  const players = overview.online?.players ?? [];
  onlineIds = new Set(players.map((p) => p.steamId));
  $('count-now').textContent = overview.online ? String(players.length) : '–';
  renderReviewCounts();
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
  renderPlayers(overview);
  renderJoins(overview);
  renderGriefers(overview);
  renderIncidents(overview);
  renderSteam(overview);
  renderModeration(overview);
  renderRecent();
  if (tab === 'players') renderHistory();
  if (peekDialog.open) renderPeek();
  server.render(overview, { open: tab === 'server' });
  loadCommands(
    panelTools,
    (text) => {
      actMissing = text;
      setStatus($('peek-act-note'), text);
    },
    actReady,
  );
  loadCommands(
    commands,
    (text) => {
      commandMissing = text;
      setStatus($('command-note'), text);
    },
    commandsReady,
  );
};

for (const button of document.querySelectorAll('.period button[data-days]')) {
  button.addEventListener('click', () => {
    period = Number(button.dataset.days);
    focus = null;
    load();
  });
}

// Sections: click, or ← → Home End from their tabs.
for (const t of SECTIONS) $(`tab-${t}`).addEventListener('click', () => selectTab(t));
tabKeys(SECTIONS, () => tab, selectTab);

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
$('look-alerts').addEventListener('click', () => setAlerts(!alertsOn));
alertsNote();
// Browsers only start sound after a click or key press on the page.
if (alertsOn) {
  const unlock = () => startAudio();
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

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

if (demo) startDemoFeed();

// The Queue's list of flagged players (see queue.js), with what staff last did to each in the period. With a bot that
// keeps "Dealt with", that takes the place of the ✓.
const queue = createQueue({
  who,
  quickActs: (p) => quickActs(p, { check: data?.dealt === undefined }),
  actMenu,
  deal: dealWith,
  lastAction: (steamId) => {
    const e = data?.moderation.find((m) => m.player.steamId === steamId);
    return e ? `${modActionLabel(e.action)} ${timeAgo(data.generatedAt - e.at)} · ${staffBy(e, data.staff ?? {})}` : null;
  },
});

// The Server section (see server.js). A dot on its tab while an editor has changes not saved yet.
const server = createServer({
  who,
  act,
  changed: (dirty) => {
    $('dirty-server').hidden = !dirty;
  },
  selected: () => {
    if (tab === 'server') keepHash();
  },
});

// Players, before a search or a player: those staff acted on lately, and who joined or left lately. Each opens their
// history.
const renderRecent = () => {
  const showing = historyPlayer === null && $('history-search').value.trim() === '';
  $('players-recent').hidden = !showing;
  if (!showing || !data) return;
  const now = data.generatedAt;
  const { acted, seen } = recentPlayers({ moderation: data.moderation, joins: data.joins ?? [] });
  const item = (player, text) =>
    el(
      'li',
      {},
      el('button', { type: 'button', className: 'link-button player-name', textContent: player.name, title: `Steam ID ${player.steamId}`, onclick: () => openHistory(player) }),
      onlineIds.has(player.steamId) ? badge('In game', 'accent') : null,
      el('span', { className: 'muted', textContent: ` ${text}` }),
    );
  const list = (node, items, empty) => node.replaceChildren(...(items.length > 0 ? items : [el('li', { className: 'muted', textContent: empty })]));
  list($('recent-acted'), acted.map((a) => item(a.player, `${modActionLabel(a.action)} ${timeAgo(now - a.at)}`)), 'Nobody in this period.');
  list(
    $('recent-seen'),
    seen.map((j) => item(j.player, `${j.kind === 'joined' ? 'joined' : 'left'} ${timeAgo(now - j.at)}`)),
    data.joins === undefined ? 'The bot does not keep who joins and leaves yet.' : 'Nobody lately.',
  );
};
$('history-search').addEventListener('input', renderRecent);

// The command search, Ctrl K or Search in the staff bar (see palette.js): the sections, every staff command, and any
// player the bot knows. Going to a section closes a player's panel or a command's form, which would cover it.
const go = (section, view = null) => () => {
  if (peekDialog.open) peekDialog.close();
  if (commandDialog.open) commandDialog.close();
  if (section === 'queue') showQueueView(view);
  if (section === 'server') server.show(view);
  selectTab(section);
};
const PLACES = [
  { label: 'Now', note: 'Who is on, and every kill', words: 'live server list kill feed joins leaves', run: go('now') },
  { label: 'Queue: flagged players', note: 'Everyone the bot flagged, one row each', words: 'review flags', run: go('queue', 'flagged') },
  { label: 'Queue: by flag', note: 'Headshots, risky Steam accounts, possible griefers', words: 'review headshots steam griefers weapons to name', run: go('queue', 'flags') },
  { label: 'Queue: team kills', note: 'Team kills and vehicle suicides', words: 'incidents', run: go('queue', 'teamkills') },
  { label: 'Queue: moderation log', note: 'What staff did', words: 'warnings kicks bans unbans vip', run: go('queue', 'log') },
  { label: 'Players', note: 'Any player’s history', words: 'history record find', run: go('players') },
  { label: 'Server: bans', note: 'Everyone banned, with the reason', words: 'settings unban', run: go('server', 'bans') },
  { label: 'Server: VIP', note: 'Whitelist slots and why, staff Steam accounts', words: 'settings whitelist slots', run: go('server', 'vip') },
  { label: 'Server: rotations', note: 'The maps for each day', words: 'settings maps week', run: go('server', 'rotations') },
  { label: 'Server: lines', note: 'What the bot says in game', words: 'settings messages seeding welcome', run: go('server', 'lines') },
  { label: 'Server: weapon rules', note: 'Weapons the bot warns or kicks for', words: 'settings', run: go('server', 'rules') },
  { label: 'Keyboard shortcuts', note: 'Every key on this page', words: 'keys help', run: () => $('keys').showModal() },
];
const palette = createPalette({
  dialog: $('palette'),
  input: $('palette-input'),
  list: $('palette-list'),
  items: (query) => [
    ...PLACES.filter((p) => matches(`${p.label} ${p.note} ${p.words}`, query)).map((p) => ({ group: 'Go to', label: p.label, note: p.note, run: p.run })),
    ...commands.list
      .filter((t) => matches(`${t.label} ${t.group} ${t.key}`, query))
      .map((t) => ({ group: 'Commands', label: t.label, note: t.group, run: () => openCommand(t.key) })),
  ],
  // Players by name or Steam ID, from the same suggestions as the commands' player lists.
  find: async (query) => {
    const { ok, json } = await call('admin/suggest', { name: 'player', options: { player: query }, focused: 'player' });
    const choices = ok ? (json?.choices ?? []) : [];
    const direct = /^\d{17}$/.test(query) && !choices.some((c) => c.value === query) ? [{ name: `Steam ID ${query}`, value: query }] : [];
    return [...choices, ...direct].map((c) => {
      const [name, ...rest] = c.name.split(' · ');
      return { group: 'Players', label: name, note: rest.join(' · '), run: () => peek({ steamId: c.value, name }) };
    });
  },
});
$('search-open').addEventListener('click', () => palette.open());
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k' || data === null) return;
  // Over the page, a player's panel or a command's form, but not over a question, the keys or the Steam box.
  if ([...document.querySelectorAll('dialog[open]')].some((d) => ![peekDialog, commandDialog, $('palette')].includes(d))) return;
  event.preventDefault();
  if ($('palette').open) $('palette').close();
  else palette.open();
});

start({
  route,
  isRoute: isTabHash,
  days: () => period,
  show,
  // The headshots and the player shown on History load with each refresh, and the live kill feed opens once signed in.
  loaded: () => {
    loadKills();
    if (tab === 'players') loadHistory();
    connectFeed();
  },
  signedOut,
  // The live kill feed closes while nobody is looking, and opens again with the latest kills.
  hidden: disconnectFeed,
  visible: connectFeed,
  // With alerts on, the page keeps checking while its tab is in the background.
  background: () => alertsOn,
});
