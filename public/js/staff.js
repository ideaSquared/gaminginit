import { demoAdmin, demoCall, demoCommands } from './demo.js';
import { clockHour, readSteamId, sessionExpiry, signInResult, staffBy, steamLinkedText } from './format.js';
import { demo, keepQuery, showNotice, thisPage } from './live.js';
import { el, link } from './views.js';

// What the two staff pages share: Moderation (admin.html, see admin.js) and Server settings (server-settings.html, see
// settings.js). Staff sign in with Discord through the bot; the bot checks they are staff and sends them back with a
// session token, which is kept for this browser and sent with each request, so signing in on one page signs in on both.
// Each page loads the bot's staff overview every minute while it is visible. Staff link the Steam account they play on,
// so the bot never counts them as seeders: whichever page they open asks once each sign-in until they have. ?demo shows
// sample data without signing in.

// The bot named in this page's own settings, never one named in the address (?stats=): a link could otherwise send a
// signed-in staff member's session to another site. To try a local bot, edit the meta tag in a local copy.
const botBase = document.querySelector('meta[name="stats-url"]')?.content ?? '';
export const configured = botBase !== '' && !botBase.includes('YOUR-SUBDOMAIN');
export const botUrl = (path) => new URL(path, botBase).href;

export const REFRESH_MS = 60_000;
const SESSION_KEY = 'gaminginit-staff-session';
// A session this close to running out is dropped, so a request never goes out with one that has.
const EXPIRY_MARGIN_MS = 60_000;

export const $ = (id) => document.getElementById(id);

// Sets a status line only when its words change, so a refresh does not make a screen reader say them again.
export const setStatus = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

// A row of filter buttons drawn in place of the last, keeping keyboard focus on the button for the same choice
// (`data-key`) when one of the old ones had it, without scrolling to it: a refresh redraws the row while staff may have
// scrolled away from it.
export const replaceButtons = (row, buttons) => {
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
export const loadToken = () => {
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

// In the reader's own time: "Fri 3 Oct, 21:40".
export const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });

// A Steam ID, linking to its Steam profile.
export const steamLink = (steamId) =>
  el('a', {
    className: 'steam-id',
    href: `https://steamcommunity.com/profiles/${steamId}`,
    rel: 'noopener noreferrer',
    target: '_blank',
    textContent: steamId,
  });

export const badge = (text, kind = '') => el('span', { className: `badge${kind ? ` badge-${kind}` : ''}`, textContent: text });

export const table = (node, headers, rows, empty) => {
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

export const cell = (...children) => el('td', {}, ...children);
export const number = (value) => el('td', { className: 'num', textContent: String(value) });

// Who did something, by name. Someone the bot has no name for yet links to their Discord profile, which opens in
// Discord with their name.
export const staffCell = (entry, staff = {}) => {
  const text = staffBy(entry, staff);
  if (!/^\d{17,20}$/.test(entry.by) || staff[entry.by] || entry.byName) return cell(text);
  return cell(el('a', { href: `https://discord.com/users/${entry.by}`, rel: 'noopener noreferrer', target: '_blank', textContent: text }));
};

// A player's history, on the Moderation page, from any page. Keeps ?demo, so a preview stays a preview.
export const historyHref = (steamId) => keepQuery(`admin#history/${steamId}`);

// The page's tabs: click, or ← → Home End from the tab bar. `select(name, { focus })` shows one.
export const tabKeys = (tabs, current, select) =>
  document.querySelector('.admin-tabs').addEventListener('keydown', (event) => {
    const i = tabs.indexOf(current());
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], { focus: true });
  });

// Shows one tab of the page's tab bar and hides the rest.
export const showTab = (tabs, shown, { focus = false } = {}) => {
  for (const t of tabs) {
    const on = t === shown;
    $(`tab-${t}`).setAttribute('aria-selected', String(on));
    $(`tab-${t}`).tabIndex = on ? 0 : -1;
    $(`panel-${t}`).hidden = !on;
  }
  if (focus) $(`tab-${shown}`).focus();
};

// What the page does with the bot's answers, set by start(): `days()` for the overview's period, `show(overview)` to
// draw it, `loaded()` after each load (for more to load with it), `signedOut()` to forget what the page had,
// `visible()` and `hidden()` as the browser tab is shown and hidden.
const page = {
  days: () => 7,
  show: () => undefined,
  loaded: () => undefined,
  signedOut: () => undefined,
  visible: () => undefined,
  hidden: () => undefined,
};

// The staff overview the page last drew (GET /api/admin/overview), for the Steam dialog and the staff names.
let current = null;
let timer = 0;
let lastLoad = 0;
// Bumped by each load and by signing out, so an answer that comes back after a newer load started, or after signing
// out, is dropped.
let generation = 0;

const signInHref = () => {
  const url = new URL(botUrl('/auth/login'));
  url.searchParams.set('return', location.origin + location.pathname + location.search);
  return url.href;
};

const signedOut = (message) => {
  generation += 1;
  clearTimeout(timer);
  document.body.classList.remove('refreshing');
  current = null;
  $('admin-body').hidden = true;
  $('admin-user').hidden = true;
  $('staff-pages').hidden = true;
  $('signin').hidden = false;
  $('signin-link').href = signInHref();
  $('signin-error').hidden = !message;
  $('signin-error').textContent = message ?? '';
  if ($('steam-dialog').open) $('steam-dialog').close();
  page.signedOut();
};

const signOut = () => {
  forgetToken();
  signedOut(null);
};

const RAN_OUT = 'Your sign-in has run out. Sign in again.';

// Reads from the bot's staff API as the signed-in staff member.
export const get = async (path) => {
  const token = loadToken();
  if (!token) {
    signedOut(RAN_OUT);
    return { ok: false, status: 401, json: { error: RAN_OUT } };
  }
  const response = await fetch(botUrl(path), { headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    forgetToken();
    signedOut(RAN_OUT);
  }
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => null) };
};

// Posts to the bot's staff API as the signed-in staff member, for the admin tools. ?demo answers with sample data.
export const call = async (path, body) => {
  if (demo) return demoCall(path, body);
  const token = loadToken();
  if (!token) {
    signedOut(RAN_OUT);
    return { ok: false, json: { error: RAN_OUT } };
  }
  const response = await fetch(botUrl(path), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    forgetToken();
    signedOut(RAN_OUT);
  }
  return { ok: response.ok, json: await response.json().catch(() => null) };
};

// The Discord names of staff, by user ID, as the bot last sent them.
export const staffNames = () => current?.staff ?? {};

// The signed-in staff member's linked Steam account, or null.
export const myProfile = (overview) => overview?.staffProfiles?.find((p) => p.userId === overview.user?.id) ?? null;

// The bot's staff commands, once, for the admin tools' forms. `note` says when the bot has none; `ready()` is called
// once the tools have them.
let commandsAsked = false;
export const loadCommands = async (tools, note, ready = () => undefined) => {
  if (commandsAsked || tools.ready) return;
  commandsAsked = true;
  if (demo) {
    tools.setCommands(demoCommands);
    ready();
    return;
  }
  try {
    const response = await fetch(botUrl('admin/commands'), { headers: { accept: 'application/json', authorization: `Bearer ${loadToken()}` } });
    if (response.status === 404) {
      note('The bot does not have the admin tools yet. Deploy the latest bot.');
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    tools.setCommands((await response.json()).commands ?? []);
    ready();
  } catch (error) {
    console.error('Could not load the admin tools', error);
    // Asked again with the next refresh.
    commandsAsked = false;
  }
};

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

export const openSteam = () => {
  if (steamDialog.open) return;
  const mine = myProfile(current);
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

$('steam-cancel').addEventListener('click', () => steamDialog.close());
$('steam-done-close').addEventListener('click', () => steamDialog.close());
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

// Who is signed in, with their Steam account and a way to sign out, and the Steam dialog the first time each sign-in
// for staff who have not linked theirs. Each page calls this as it draws the overview.
export const showAccount = (overview) => {
  current = overview;
  $('signin').hidden = true;
  $('admin-body').hidden = false;
  $('staff-pages').hidden = false;
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
  if (overview.staffProfiles !== undefined && !mine && !askedThisSignIn()) {
    noteAsked();
    openSteam();
  }
};

// A refusal the bot explained, such as staff sign-in not being set up on it.
class BotSaid extends Error {}

// Loads the staff overview, draws it, and loads it again in a minute while the browser tab is visible.
export const load = async () => {
  clearTimeout(timer);
  lastLoad = Date.now();
  const mine = ++generation;
  const fresh = () => mine === generation;
  if (demo) {
    page.show(demoAdmin(page.days(), Date.now()));
    page.loaded();
    return;
  }
  const token = loadToken();
  if (!token) {
    signedOut(current ? RAN_OUT : null);
    return;
  }
  document.body.classList.add('refreshing');
  try {
    const response = await fetch(botUrl(`admin/overview?days=${page.days()}`), {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
    if (!fresh()) return;
    if (response.status === 401) {
      forgetToken();
      signedOut(RAN_OUT);
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
    if (!fresh()) return;
    showNotice();
    page.show(overview);
    page.loaded();
  } catch (error) {
    if (!fresh()) return;
    console.error('Could not load the staff page', error);
    const why = error instanceof BotSaid ? ` The bot says: ${error.message}` : '';
    showNotice(
      (current ? 'Could not refresh. Showing the last we had; trying again in a minute.' : 'Could not load the staff page. Trying again in a minute.') + why,
    );
  } finally {
    if (fresh()) {
      document.body.classList.remove('refreshing');
      if (!document.hidden && loadToken()) timer = setTimeout(load, REFRESH_MS);
    }
  }
};

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

// Starts the page. `route()` shows the tab the address names after the #, and `isRoute(hash)` says whether a # is one
// of those (rather than the bot's answer to signing in). See `page` for the rest.
export const start = ({ route, isRoute, ...hooks }) => {
  Object.assign(page, hooks);

  window.addEventListener('hashchange', () => {
    // A link to a tab or a player's history, or back and forward between them.
    if (isRoute(location.hash)) {
      route();
      return;
    }
    if (!demo && configured) arrive();
  });

  // Only refresh while someone is looking; catch up straight away when they come back, or when nothing has loaded yet.
  document.addEventListener('visibilitychange', () => {
    if (demo || !configured || !loadToken()) return;
    if (document.hidden) {
      clearTimeout(timer);
      page.hidden();
      return;
    }
    page.visible();
    if (!current || Date.now() - lastLoad >= REFRESH_MS) load();
    else timer = setTimeout(load, REFRESH_MS - (Date.now() - lastLoad));
  });

  // Read before the tab is picked, as picking one tidies the # away.
  const returned = signInResult(location.hash);
  route();

  if (demo) {
    showNotice('Showing sample data, not the real server. ', link(thisPage((p) => p.delete('demo')), 'Sign in for the real page'));
    load();
  } else if (!configured) {
    showNotice('Live stats are not connected yet. ', link(thisPage((p) => p.set('demo', '')), 'Preview with sample data'));
  } else {
    arrive(returned);
  }
};
