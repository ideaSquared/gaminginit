import { sessionExpiry } from './format.js';
import { readHash } from './accountmodel.js';
import { botUrl, configured } from './session.js';

// A player's session (see accountmodel.js): they sign in with Discord through the bot, which sends them back with a session
// token. It is kept for this browser and sent with each request to the bot's /api/account. A different token from staff's:
// staff routes never accept it. The bot is the one named in this page's own settings, never one named in the address.

export { configured };

const KEY = 'gaminginit-player-session';
// A session this close to running out is dropped, so a request never goes out with one that has.
const EXPIRY_MARGIN_MS = 60_000;

// Storage can be off (a private window, blocked site data): then the sign-in lasts until the page is closed.
let memoryToken = null;

export const savePlayerToken = (token) => {
  memoryToken = token;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Kept in memory only.
  }
};

export const loadPlayerToken = () => {
  let token = memoryToken;
  try {
    token = localStorage.getItem(KEY) ?? token;
  } catch {
    // Kept in memory only.
  }
  const expiresAt = token ? sessionExpiry(token) : null;
  return expiresAt !== null && expiresAt - EXPIRY_MARGIN_MS > Date.now() ? token : null;
};

export const forgetPlayerToken = () => {
  memoryToken = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
};

// Where to send someone to sign in with Discord, and back to this page afterwards. `join` also asks Discord to let the bot
// add them to the server: a separate button, because Discord's own screen says "Join servers for you".
export const signInHref = ({ join = false } = {}) => {
  const url = new URL(botUrl('/auth/player/login'));
  url.searchParams.set('return', location.origin + location.pathname + location.search);
  if (join) url.searchParams.set('join', '1');
  return url.href;
};

// To Steam to prove which Steam account is theirs, and back to the account page.
export const steamHref = () => {
  const url = new URL(botUrl('/auth/steam'));
  url.searchParams.set('return', `${location.origin}${new URL('account', location.href).pathname}`);
  return url.href;
};

// Takes what the bot put after the # when it sent the browser back, keeps the session and tidies the address. Returns what
// was there, with the session left out of it.
export const takeResult = () => {
  const found = readHash(location.hash);
  if (found.session === undefined && found.steamproof === undefined && found.error === undefined) return {};
  const { session, ...rest } = found;
  if (session !== undefined) savePlayerToken(session);
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    // The address stays as it is.
  }
  return rest;
};

// Asks the bot about the signed-in player. `status` 0 is no answer at all; 401 means signed out (and forgets the session).
export const askBot = async (path, { method = 'GET', body } = {}) => {
  const token = loadPlayerToken();
  if (token === null || !configured) return { status: 401, data: null };
  try {
    const response = await fetch(botUrl(path), {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401) forgetPlayerToken();
    return { status: response.status, data: await response.json().catch(() => null) };
  } catch {
    return { status: 0, data: null };
  }
};
