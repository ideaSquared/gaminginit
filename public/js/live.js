import { demoStats } from './demo.js';
import { link } from './views.js';

// Loads the bot's numbers for each page, and keeps them fresh.

const REFRESH_MS = 60_000;

// ?demo shows sample numbers; ?stats=<url> reads another bot, e.g. one running locally with `wrangler dev`.
const params = new URLSearchParams(location.search);
export const demo = params.has('demo');
const statsUrl = params.get('stats') ?? document.querySelector('meta[name="stats-url"]')?.content ?? '';
const configured = statsUrl !== '' && !statsUrl.includes('YOUR-SUBDOMAIN');

// The bot's other endpoints sit next to /api/stats: apiUrl('players') is its /api/players.
export const apiUrl = (path) => (configured ? new URL(path, statsUrl).href : '');

// Links between the pages keep ?demo or ?stats, so a preview stays a preview.
export const keepQuery = (href) => {
  const url = new URL(href, location.href);
  for (const key of ['demo', 'stats']) if (params.has(key)) url.searchParams.set(key, params.get(key));
  return url.href;
};

for (const a of document.querySelectorAll('a[data-keep-query]')) a.href = keepQuery(a.getAttribute('href'));

// On phones the page links scroll sideways in one row. Bring this page's link into view.
const sections = document.querySelector('.nav-sections');
const current = sections?.querySelector('[aria-current="page"]');
if (current) {
  const hidden = current.getBoundingClientRect().right - sections.getBoundingClientRect().right;
  if (hidden > 0) sections.scrollLeft += hidden + 32;
}

// This page's own address with a query parameter changed, so a page that shows one player keeps its id.
export const thisPage = (change) => {
  const url = new URL(location.href);
  change(url.searchParams);
  return url.pathname + url.search;
};

// A link to part of a page, like /#join or leaderboard#weapons, can miss: the part is hidden until the bot's numbers
// arrive, or they fill in what is above it and push it down, or the page only builds it from them, like a match's card
// on /matches. So once the first numbers are in, find it and scroll there, unless the reader has started scrolling
// themselves.
let hashId = null;
try {
  hashId = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : null;
} catch {
  // A malformed #fragment: nothing to scroll to.
}
const readerMoved = () => {
  hashId = null;
};
for (const type of ['wheel', 'touchmove', 'keydown', 'mousedown']) addEventListener(type, readerMoved, { once: true, passive: true });
const scrollToRevealed = () => {
  const target = hashId === null ? null : document.getElementById(hashId);
  if (target && target.getClientRects().length > 0) target.scrollIntoView();
  hashId = null;
};

export const showNotice = (...content) => {
  const notice = document.getElementById('notice');
  notice.replaceChildren(...content);
  notice.hidden = content.length === 0;
};

// Calls render(data) now and after every refresh: once a minute, and only while the tab is visible. data is null
// until the first load succeeds. By default it loads /api/stats; a page can load another endpoint with `url` and
// make sample data for ?demo with `sample(now)`. A 404 calls `missing()` and stops refreshing.
export const startLive = (render, { url = statsUrl, sample = demoStats, missing = null } = {}) => {
  let data = null;
  let lastLoad = 0;
  let timer = 0;
  let stopped = false;

  const load = async () => {
    clearTimeout(timer);
    lastLoad = Date.now();
    if (demo) {
      data = sample(Date.now());
      showNotice('Showing sample numbers, not the real server. ', link(thisPage((p) => p.delete('demo')), 'See live stats'));
      if (data === null && missing) {
        stopped = true;
        missing();
        return;
      }
      render(data);
      scrollToRevealed();
      return;
    }
    if (!configured) {
      showNotice('Live stats are not connected yet. ', link(thisPage((p) => p.set('demo', '')), 'Preview with sample numbers'));
      render(data);
      return;
    }

    document.body.classList.add('refreshing');
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (response.status === 404 && missing) {
        stopped = true;
        showNotice();
        missing();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      showNotice();
      render(data);
      scrollToRevealed();
    } catch (error) {
      console.error('Could not load stats', error);
      showNotice(
        data ? 'Could not refresh the live stats. Showing the last numbers we had; trying again in a minute.' : 'Could not load the live stats. Trying again in a minute.',
      );
      if (!data) render(data);
    } finally {
      document.body.classList.remove('refreshing');
      if (!document.hidden && !stopped) timer = setTimeout(load, REFRESH_MS);
    }
  };

  // Only poll while someone is looking; catch up straight away when they come back.
  document.addEventListener('visibilitychange', () => {
    if (stopped) return;
    if (document.hidden) clearTimeout(timer);
    else if (Date.now() - lastLoad >= REFRESH_MS) load();
    else timer = setTimeout(load, REFRESH_MS - (Date.now() - lastLoad));
  });

  load();
};

// While the bot's WebSocket is down, a page that updates as things happen loads its endpoint this often instead.
const PUSH_POLL_MS = 15_000;
// Waits before trying the WebSocket again: twice as long each time, up to the last.
const RECONNECT_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000];
// Keeps the WebSocket open through quiet spells. The bot answers without waking up.
const PING_MS = 30_000;
// How often ?demo moves its sample on.
const DEMO_MS = 3_000;

// The bot's WebSocket next to /api/stats: socketUrl('live/socket') is its wss://…/api/live/socket.
const socketUrl = (path) => {
  const url = new URL(path, statsUrl);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return url.href;
};

// Calls render(data) with what the bot pushes over its WebSocket at `socket`, as it happens, and onState(state) as
// the connection changes: 'live' while pushed, 'connecting', 'polling' while it loads `url` every 15 seconds instead
// (only while the tab is visible), and 'demo'. data is null until the first update. ?demo renders sample(now) every 3
// seconds. When `url` answers 404 (a bot without it), it calls missing() and stops.
export const startPush = (render, { url, socket, sample, onState = () => {}, missing = () => {} }) => {
  if (demo) {
    onState('demo');
    showNotice('Showing a sample match, not the real server. ', link(thisPage((p) => p.delete('demo')), 'See the live match'));
    const tick = () => render(sample(Date.now()));
    tick();
    setInterval(() => {
      if (!document.hidden) tick();
    }, DEMO_MS);
    return;
  }
  if (!configured) {
    onState('off');
    showNotice('Live stats are not connected yet. ', link(thisPage((p) => p.set('demo', '')), 'Preview with a sample match'));
    render(null);
    return;
  }

  let data = null;
  let attempt = 0;
  let pollTimer = 0;
  let pingTimer = 0;
  let stopped = false;

  const poll = async () => {
    clearTimeout(pollTimer);
    if (stopped) return;
    pollTimer = setTimeout(poll, PUSH_POLL_MS);
    if (document.hidden) return;
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (response.status === 404) {
        stopped = true;
        clearTimeout(pollTimer);
        onState('off');
        showNotice();
        missing();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      showNotice();
      render(data);
    } catch (error) {
      console.error('Could not load the live match', error);
      showNotice(data ? 'Could not refresh the live match. Showing the last we had; trying again.' : 'Could not load the live match. Trying again.');
      if (!data) render(null);
    }
  };

  const connect = () => {
    if (stopped) return;
    onState('connecting');
    let ws;
    try {
      ws = new WebSocket(socketUrl(socket));
    } catch {
      dropped();
      return;
    }
    ws.onopen = () => {
      attempt = 0;
      clearTimeout(pollTimer);
      onState('live');
      clearInterval(pingTimer);
      pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
    };
    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      showNotice();
      render(data);
    };
    // Every failure ends in close, so it is handled once, there.
    ws.onclose = () => dropped();
  };

  const dropped = () => {
    clearInterval(pingTimer);
    if (stopped) return;
    onState('polling');
    poll();
    const wait = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)];
    attempt += 1;
    setTimeout(connect, wait + Math.random() * 1_000);
  };

  connect();
};
