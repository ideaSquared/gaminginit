import { demoStats } from './demo.js';
import { link } from './views.js';

// Loads the bot's numbers for each page, and keeps them fresh.

const REFRESH_MS = 60_000;

// ?demo shows sample numbers; ?stats=<url> reads another bot, e.g. one running locally with `wrangler dev`.
const params = new URLSearchParams(location.search);
const demo = params.has('demo');
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

// This page's own address with a query parameter changed, so a page that shows one player keeps its id.
const thisPage = (change) => {
  const url = new URL(location.href);
  change(url.searchParams);
  return url.pathname + url.search;
};

const showNotice = (...content) => {
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
