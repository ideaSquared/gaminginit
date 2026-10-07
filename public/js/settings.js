import { demoLines, demoLinesChange, demoRotations, demoRotationsChange, demoRules, demoRulesChange } from './demo.js';
import { staffNote } from './format.js';
import { createLines } from './lines.js';
import { demo, keepQuery, showNotice } from './live.js';
import { createRotations } from './rotations.js';
import { createRules } from './rules.js';
import {
  $,
  badge,
  call,
  cell,
  get,
  historyHref,
  load,
  loadCommands,
  loadToken,
  myProfile,
  openSteam,
  setStatus,
  showAccount,
  showTab,
  staffCell,
  staffNames,
  start,
  steamLink,
  table,
  tabKeys,
  when,
} from './staff.js';
import { createTools } from './tools.js';
import { el } from './views.js';

// The staff page for the server's settings, in four tabs. Admin: the admin tools (every staff command), the bans on the
// server, the reserved slots and staff Steam accounts. Rotations: the map rotations, the week and what is on the server
// (see rotations.js). Lines: what the bot says in game (see lines.js). Weapon rules: weapons the bot warns or kicks for
// (see rules.js). Watching the server and acting on players is on the Moderation page (admin.js); any player's
// name here opens their history there. Signing in, the Steam account and loading are in staff.js.

// The tab shown, which the address keeps after the # for all but the first.
const TABS = ['admin', 'rotations', 'lines', 'rules'];
// The Moderation page's tabs, which a link here may name by mistake.
const MODERATION_TABS = ['live', 'review', 'history', 'players', 'alerts', 'kills'];
let tab = TABS[0];
let data = null;

// A player's name, opening their history on the Moderation page, with their Steam ID linking to their Steam profile.
const who = (player) =>
  el(
    'span',
    { className: 'staff-player' },
    el('a', { className: 'link-button player-name', href: historyHref(player.steamId), textContent: player.name }),
    steamLink(player.steamId),
  );

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

const rules = createRules({
  root: $('rules'),
  load: () => (demo ? demoRules() : get('admin/rules')),
  send: (body) => (demo ? demoRulesChange(body) : call('admin/rules', body)),
});

const EDITORS = { rotations, lines, rules };

// A dot on the tab of each editor with changes not saved yet, so they are not forgotten on another tab. Looked at again
// after anything in an editor changes, at most once a frame.
const markUnsaved = () => {
  for (const [name, editor] of Object.entries(EDITORS)) $(`dirty-${name}`).hidden = !editor.dirty;
};
let unsavedFrame = 0;
const unsavedSoon = () => {
  cancelAnimationFrame(unsavedFrame);
  unsavedFrame = requestAnimationFrame(markUnsaved);
};
const editorChanges = new MutationObserver(unsavedSoon);
for (const name of Object.keys(EDITORS)) editorChanges.observe($(name), { subtree: true, childList: true, attributes: true, characterData: true });
for (const type of ['input', 'change']) document.addEventListener(type, unsavedSoon, true);

const tools = createTools({ root: $('tools'), call, onChanged: () => load(), staff: staffNames });

const selectTab = (name, { focus = false } = {}) => {
  tab = TABS.includes(name) ? name : TABS[0];
  showTab(TABS, tab, { focus });
  const hash = tab === TABS[0] ? '' : `#${tab}`;
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  // Loaded when first opened, as only staff working on rotations, lines or weapon rules need them.
  if (data) EDITORS[tab]?.show();
};

const fromHash = (hash) => hash.slice(1).split('/')[0];
const isTabHash = (hash) => hash === '' || TABS.includes(fromHash(hash)) || MODERATION_TABS.includes(fromHash(hash));

// Shows the tab the address names. A link to one of the Moderation page's tabs goes there.
const route = () => {
  if (MODERATION_TABS.includes(fromHash(location.hash))) {
    location.replace(keepQuery(`admin${location.hash}`));
    return;
  }
  selectTab(fromHash(location.hash));
};

// Opens an admin tool with the player picked, such as Unban, at the top of the Admin tab.
const act = (key, player) => {
  tools.use(key, player.steamId, player.name);
  $('tools-title').closest('article').scrollIntoView({ block: 'start' });
};

// A row's button that opens an admin tool with that player picked.
const actButton = (text, key, player) =>
  el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: text, onclick: () => act(key, player) });

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

const ghostButton = (text, onclick) => el('button', { type: 'button', className: 'btn btn-ghost btn-small', textContent: text, onclick });

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

const render = (overview) => {
  data = overview;
  showAccount(overview);
  renderBans(overview);
  renderReserved(overview);
  renderStaffSteam(overview);
  loadCommands(tools, (text) => {
    $('tools-note').textContent = text;
  });
  EDITORS[tab]?.ensure();
};

$('staff-steam-mine').addEventListener('click', () => openSteam());

// Tabs: click, or ← → Home End from the tab bar.
for (const t of TABS) $(`tab-${t}`).addEventListener('click', () => selectTab(t));
tabKeys(TABS, () => tab, selectTab);

start({
  route,
  isRoute: isTabHash,
  show: render,
  signedOut: () => {
    data = null;
    rotations.reset();
    lines.reset();
    rules.reset();
  },
});
