// Not used by name: loading it shows the site-wide notice, keeps ?demo and similar on links, and scrolls the nav.
import './live.js';
import { configured, botUrl } from './session.js';
import { el, setText } from './views.js';
import { share, statusText, winnerOf } from './votemodel.js';

// The next-map vote page. Members vote with buttons in a Discord channel (see the bot's mapvote.ts); this page shows the
// same counts from GET /api/vote, refreshes them, and sends people to the channel.

const $ = (id) => document.getElementById(id);

// Fast enough that the counts feel live; slower once the vote is over.
const OPEN_MS = 5_000;
const IDLE_MS = 30_000;

let vote = null;
let discord = null;
let loaded = false;
// What the screen reader was last told, so it hears the vote open, close and end but not every count and tick.
let announced = '';

const render = () => {
  const now = Date.now();
  const open = vote !== null && vote.open && now < vote.closesAt;
  const status = loaded ? statusText(vote, now) : 'Loading the vote…';
  setText($('vote-status'), status);
  if (loaded) {
    const phase = vote === null ? 'none' : open ? `open:${vote.id}` : `over:${vote.id}:${vote.winner?.map ?? ''}:${vote.pending}`;
    if (phase !== announced) {
      announced = phase;
      // The countdown is left out: it changes every second.
      setText($('vote-announce'), open ? `A vote is open for the map after ${vote.fromName}.` : status);
    }
  }
  const winner = winnerOf(vote);
  $('vote-options').replaceChildren(
    ...(vote?.options ?? []).map((o) => {
      const percent = share(o.votes, vote.total);
      const row = el(
        'div',
        { className: 'vote-option' },
        el('span', { className: 'vote-name', textContent: o.name }),
        el('span', { className: 'vote-count', textContent: `${o.votes} ${o.votes === 1 ? 'vote' : 'votes'} · ${percent}%` }),
        el('span', { className: 'vote-bar', 'aria-hidden': 'true' }, el('span', { className: 'vote-fill', style: `width: ${percent}%` })),
      );
      if (winner === o.map) row.dataset.winner = '';
      return row;
    }),
  );
  // The way in: the channel when the bot knows it, else the community's Discord invite already on every page.
  const link = $('vote-discord');
  link.hidden = vote === null || !open;
  if (discord !== null) link.href = discord;
};

const load = async () => {
  try {
    const response = await fetch(botUrl('/api/vote'), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    vote = body.vote ?? null;
    discord = body.discord ?? null;
    loaded = true;
  } catch {
    if (!loaded) setText($('vote-status'), 'Could not load the vote. Try again in a minute.');
    return;
  }
  render();
};

const tick = async () => {
  if (!document.hidden) await load();
  setTimeout(tick, vote?.open ? OPEN_MS : IDLE_MS);
};

if (!configured) {
  setText($('vote-status'), 'The vote is not connected yet.');
} else {
  tick();
  // The countdown moves every second without asking the bot.
  setInterval(() => {
    if (!document.hidden && loaded) render();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}
