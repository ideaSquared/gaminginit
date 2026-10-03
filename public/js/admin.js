import { demoAdmin } from './demo.js';
import {
  DEATH_TAGS,
  flagLabel,
  flagRule,
  formatHours,
  metres,
  MOD_ACTIONS,
  sessionExpiry,
  signInResult,
  staffBy,
  withVehicle,
} from './format.js';
import { demo, showNotice, thisPage } from './live.js';
import { el, link, mapTag, playerName } from './views.js';

// The staff page: possible griefers from the bot's kill feed (team kills and suicides), the incidents behind them,
// everything staff did through the bot, and the bans on the server. Staff sign in with Discord through the bot; the
// bot checks they are staff and sends them back with a session token, which this page keeps for this browser and
// sends with each request. ?demo shows sample data without signing in.

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

let period = 7;
let data = null;
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
};

const signOut = () => {
  forgetToken();
  signedOut(null);
};

// A player's name, linking to their public page, with their Steam ID linking to their Steam profile.
const who = (player) =>
  el(
    'span',
    { className: 'staff-player' },
    playerName(player),
    el('a', {
      className: 'steam-id',
      href: `https://steamcommunity.com/profiles/${player.steamId}`,
      rel: 'noopener noreferrer',
      target: '_blank',
      textContent: player.steamId,
    }),
  );

const badge = (text, kind = '') => el('span', { className: `badge${kind ? ` badge-${kind}` : ''}`, textContent: text });

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
      cell(
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
          : '',
      ),
    ),
  );
  table(
    $('griefers'),
    [
      'Player',
      ['Team kills', 'num'],
      'Teammate killed most',
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

// Staff by name, from the moderation log, for bans whose record only has a Discord user ID.
const staffNames = (overview) => new Map(overview.moderation.filter((e) => e.byName).map((e) => [e.by, e.byName]));

const renderModeration = (overview) => {
  const rows = overview.moderation.map((e) =>
    el(
      'tr',
      {},
      el('td', { className: 'when', textContent: when.format(e.at) }),
      cell(badge(MOD_ACTIONS[e.action] ?? e.action, e.action === 'ban' ? 'bad' : e.action === 'kick' ? 'hot' : '')),
      el('td', { className: 'player' }, who(e.player)),
      el('td', { className: 'reason', textContent: e.reason ?? '–' }),
      cell(staffBy(e)),
      cell(e.detail ?? ''),
    ),
  );
  table($('modlog'), ['When', 'What', 'Player', 'Reason', 'By', 'Details'], rows, 'Nothing in this period.');
};

const renderBans = (overview) => {
  if (overview.bans === null) {
    $('bans-note').textContent = 'Couldn’t read the server’s ban list just now. Trying again in a minute.';
    $('bans').replaceChildren();
    return;
  }
  $('bans-note').textContent = 'Everyone banned on the server now, with the reason. Bans made outside the bot are permanent.';
  const names = staffNames(overview);
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
      cell(b.bot ? (names.get(b.bot.by) ?? `Discord user ${b.bot.by}`) : (b.bannedBy ?? 'Outside the bot')),
      el('td', { className: 'when', textContent: b.bot ? when.format(b.bot.at) : '–' }),
      el('td', { className: 'when', textContent: b.bot?.until ? when.format(b.bot.until) : 'Never' }),
    ),
  );
  table($('bans'), ['Player', 'Reason', 'Banned by', 'Since', 'Ends'], rows, 'Nobody is banned.');
};

const render = (overview) => {
  data = overview;
  $('signin').hidden = true;
  $('admin-body').hidden = false;
  const user = $('admin-user');
  user.hidden = false;
  user.replaceChildren(
    `Signed in as ${overview.user?.name ?? 'staff'}`,
    ...(demo ? [] : [' · ', el('button', { type: 'button', className: 'link-button', textContent: 'Sign out', onclick: signOut })]),
  );
  for (const button of document.querySelectorAll('.period button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.days) === period));
  }
  const span = period === 1 ? 'Today' : `The last ${period} days`;
  $('period-note').textContent = overview.feedSince
    ? `${span} (UTC days). Team kills and suicides come from the kill feed, which the bot has had since ${overview.feedSince}.`
    : `${span} (UTC days).`;
  $('tile-flagged').textContent = String(overview.totals.flaggedPlayers);
  $('tile-teamkills').textContent = String(overview.totals.teamKills);
  $('tile-teamkills-note').textContent = overview.totals.vehicleTeamKills > 0 ? `${overview.totals.vehicleTeamKills} with a vehicle` : '';
  $('tile-vehicle').textContent = String(overview.totals.vehicleSuicides);
  $('tile-suicides').textContent = String(overview.totals.suicides);
  renderGriefers(overview);
  renderIncidents(overview);
  renderModeration(overview);
  renderBans(overview);
};

const load = async () => {
  clearTimeout(timer);
  lastLoad = Date.now();
  const mine = ++generation;
  const current = () => mine === generation;
  if (demo) {
    render(demoAdmin(period, Date.now()));
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const overview = await response.json();
    if (!current()) return;
    showNotice();
    render(overview);
  } catch (error) {
    if (!current()) return;
    console.error('Could not load the staff page', error);
    showNotice(
      data ? 'Could not refresh. Showing the last we had; trying again in a minute.' : 'Could not load the staff page. Trying again in a minute.',
    );
  } finally {
    if (current()) {
      document.body.classList.remove('refreshing');
      if (!document.hidden && loadToken()) timer = setTimeout(load, REFRESH_MS);
    }
  }
};

for (const button of document.querySelectorAll('.period button')) {
  button.addEventListener('click', () => {
    period = Number(button.dataset.days);
    focus = null;
    load();
  });
}

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
const arrive = () => {
  const result = signInResult(location.hash);
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
  if (!demo && configured) arrive();
});

if (demo) {
  showNotice('Showing sample data, not the real server. ', link(thisPage((p) => p.delete('demo')), 'Sign in for the real page'));
  load();
} else if (!configured) {
  showNotice('Live stats are not connected yet. ', link(thisPage((p) => p.set('demo', '')), 'Preview with sample data'));
} else {
  arrive();
}
