import { sessionExpiry } from './format.js';
import { readHash, signinBound } from './accountmodel.js';
import { botUrl, configured } from './session.js';

// A player's session (see accountmodel.js): they sign in with Discord through the bot, which sends them back with a session
// token. It is kept for this browser and sent with each request to the bot's /api/account. A different token from staff's:
// staff routes never accept it. The bot is the one named in this page's own settings, never one named in the address.

export { configured };

const KEY = 'gaminginit-player-session';
// Fired on the window when the session is kept or forgotten, so the header can show who is signed in.
export const SESSION_EVENT = 'gaminginit:session';
// What ties a sign-in to the browser that started it (see signInHref): kept here until the bot sends the browser back.
const NONCE_KEY = 'gaminginit-signin';
// A session this close to running out is dropped, so a request never goes out with one that has.
const EXPIRY_MARGIN_MS = 60_000;

// Storage can be off (a private window, blocked site data): then the sign-in lasts until the page is closed.
let memoryToken = null;

// Tells the page (the header's account button) that someone signed in or out.
const changed = () => dispatchEvent(new CustomEvent(SESSION_EVENT));

export const savePlayerToken = (token) => {
  memoryToken = token;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Kept in memory only.
  }
  changed();
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
  changed();
};

// A sign-in is tied to the browser that started it. The bot sends the browser back with the session after a #, and anyone can
// write such an address: without a check, a link with someone else's session in it would sign a visitor in as them, and what
// they then did (linking their Steam account, voting) would be done as that person. So each sign-in goes out with a random
// value, kept in this browser and put in the address it comes back to (`?signin=`, which the bot sends back unchanged);
// a session or Steam proof is only taken when the two match. Whoever builds the link cannot know this browser's value.
let pageNonce = null;
const nonce = () => {
  if (pageNonce === null) {
    pageNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    for (const store of [() => sessionStorage, () => localStorage]) {
      try {
        store().setItem(NONCE_KEY, pageNonce);
        break;
      } catch {
        // Storage can be off: the next one, then none (a sign-in cannot come back to a page that forgot it started).
      }
    }
  }
  return pageNonce;
};

const takeNonce = () => {
  let found = null;
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      found ??= store().getItem(NONCE_KEY);
      store().removeItem(NONCE_KEY);
    } catch {
      // Nothing kept.
    }
  }
  return found;
};

// Where to send someone to sign in with Discord, and back to this page afterwards. `join` also asks Discord to let the bot
// add them to the server: a separate button, because Discord's own screen says "Join servers for you".
export const signInHref = ({ join = false } = {}) => {
  const url = new URL(botUrl('/auth/player/login'));
  const back = new URL(location.href);
  back.hash = '';
  back.searchParams.set('signin', nonce());
  url.searchParams.set('return', back.href);
  if (join) url.searchParams.set('join', '1');
  return url.href;
};

// To Steam to prove which Steam account is theirs, and back to the account page.
export const steamHref = () => {
  const url = new URL(botUrl('/auth/steam'));
  const back = new URL('account', location.href);
  back.search = '';
  back.hash = '';
  back.searchParams.set('signin', nonce());
  url.searchParams.set('return', back.href);
  return url.href;
};

// Takes what the bot put after the # when it sent the browser back, keeps the session and tidies the address. Returns what
// was there, with the session left out of it. A session or Steam proof that did not start in this browser (see signInHref) is
// dropped, and the page is told `error: 'unbound'`.
export const takeResult = () => {
  const found = readHash(location.hash);
  if (found.session === undefined && found.steamproof === undefined && found.error === undefined) return {};
  const params = new URLSearchParams(location.search);
  const started = takeNonce();
  const bound = signinBound(started, location.search);
  params.delete('signin');
  try {
    const search = params.toString();
    history.replaceState(null, '', location.pathname + (search === '' ? '' : `?${search}`));
  } catch {
    // The address stays as it is.
  }
  const { session, ...rest } = found;
  if (!bound && (session !== undefined || rest.steamproof !== undefined)) return { error: 'unbound' };
  if (session !== undefined) savePlayerToken(session);
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
