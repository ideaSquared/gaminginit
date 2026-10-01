import { demoStats } from './demo.js';
import { link } from './views.js';

// Loads the bot's stats for either page, and keeps them fresh.

const REFRESH_MS = 60_000;

// ?demo shows sample numbers; ?stats=<url> reads another bot, e.g. one running locally with `wrangler dev`.
const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const statsUrl = params.get('stats') ?? document.querySelector('meta[name="stats-url"]')?.content ?? '';
const configured = statsUrl !== '' && !statsUrl.includes('YOUR-SUBDOMAIN');

// Links between the pages keep ?demo or ?stats, so a preview stays a preview.
if (location.search) {
  for (const a of document.querySelectorAll('a[data-keep-query]')) {
    const url = new URL(a.getAttribute('href'), location.href);
    url.search = location.search;
    a.href = url.href;
  }
}

const showNotice = (...content) => {
  const notice = document.getElementById('notice');
  notice.replaceChildren(...content);
  notice.hidden = content.length === 0;
};

// Calls render(stats) now and after every refresh: once a minute, and only while the tab is visible.
// stats is null until the first load succeeds.
export const startLive = (render) => {
  let stats = null;
  let lastLoad = 0;
  let timer = 0;

  const load = async () => {
    clearTimeout(timer);
    lastLoad = Date.now();
    if (demo) {
      stats = demoStats(Date.now());
      showNotice('Showing sample numbers, not the real server. ', link(location.pathname, 'See live stats'));
      render(stats);
      return;
    }
    if (!configured) {
      showNotice('Live stats are not connected yet. ', link('?demo', 'Preview with sample numbers'));
      render(stats);
      return;
    }

    document.body.classList.add('refreshing');
    try {
      const response = await fetch(statsUrl, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      stats = await response.json();
      showNotice();
      render(stats);
    } catch (error) {
      console.error('Could not load stats', error);
      showNotice(
        stats ? 'Could not refresh the live stats. Showing the last numbers we had; trying again in a minute.' : 'Could not load the live stats. Trying again in a minute.',
      );
      if (!stats) render(stats);
    } finally {
      document.body.classList.remove('refreshing');
      if (!document.hidden) timer = setTimeout(load, REFRESH_MS);
    }
  };

  // Only poll while someone is looking; catch up straight away when they come back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else if (Date.now() - lastLoad >= REFRESH_MS) load();
    else timer = setTimeout(load, REFRESH_MS - (Date.now() - lastLoad));
  });

  load();
};
