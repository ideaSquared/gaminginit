import { configured, botUrl } from './session.js';
import { el, setText } from './views.js';
import { newToken, refusal, share, statusText, winnerOf } from './votemodel.js';

// The next-map vote page. The bot (GET and POST /api/vote) opens a vote when a match goes live; the page shows it, takes a
// vote and refreshes the counts. No sign-in: a random token kept in this browser stands in for who is voting, and the bot
// also keeps one ballot per network (see mapvote.ts in the bot).

const $ = (id) => document.getElementById(id);

const TOKEN_KEY = 'gaminginit-vote-token';
const PICK_KEY = 'gaminginit-vote-pick';
// Fast enough that the counts feel live; slower once the vote is over.
const OPEN_MS = 5_000;
const IDLE_MS = 30_000;

// Storage can be off (a private window, blocked site data): then the token lasts until the page is closed.
let memory = {};
const read = (key) => {
  try {
    return localStorage.getItem(key) ?? memory[key] ?? null;
  } catch {
    return memory[key] ?? null;
  }
};
const write = (key, value) => {
  memory[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Kept in memory only.
  }
};

const token = () => {
  let value = read(TOKEN_KEY);
  if (!/^[0-9a-f]{32}$/.test(value ?? '')) {
    value = newToken();
    write(TOKEN_KEY, value);
  }
  return value;
};

// This browser's pick, for the vote it was made in.
const myPick = (vote) => {
  try {
    const saved = JSON.parse(read(PICK_KEY) ?? 'null');
    return saved?.poll === vote?.id ? saved.map : null;
  } catch {
    return null;
  }
};

let vote = null;
let loaded = false;
let problem = '';
let sending = false;

const render = () => {
  const now = Date.now();
  const open = vote !== null && vote.open && now < vote.closesAt;
  setText($('vote-status'), loaded ? statusText(vote, now) : 'Loading the vote…');
  const pick = myPick(vote);
  const winner = winnerOf(vote);
  const options = vote?.options ?? [];
  $('vote-options').replaceChildren(
    ...options.map((o) => {
      const percent = share(o.votes, vote.total);
      const button = el(
        'button',
        { type: 'button', className: 'vote-option', disabled: !open || sending },
        el('span', { className: 'vote-name', textContent: o.name }),
        el('span', { className: 'vote-count', textContent: `${o.votes} ${o.votes === 1 ? 'vote' : 'votes'} · ${percent}%` }),
        el('span', { className: 'vote-bar', 'aria-hidden': 'true' }, el('span', { className: 'vote-fill', style: `width: ${percent}%` })),
      );
      button.setAttribute('aria-pressed', String(pick === o.map));
      if (pick === o.map) button.dataset.mine = '';
      if (winner === o.map) button.dataset.winner = '';
      button.addEventListener('click', () => cast(o.map));
      return button;
    }),
  );
  const mine = pick === null ? null : options.find((o) => o.map === pick);
  setText($('vote-foot'), problem || (mine && open ? `You voted for ${mine.name}. Tap another map to change it.` : mine ? `You voted for ${mine.name}.` : ''));
};

const apply = (next) => {
  vote = next;
  loaded = true;
};

const load = async () => {
  try {
    const response = await fetch(botUrl('/api/vote'), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    apply((await response.json()).vote ?? null);
  } catch {
    if (!loaded) setText($('vote-status'), 'Could not load the vote. Try again in a minute.');
    return;
  }
  render();
};

const cast = async (map) => {
  if (vote === null || sending) return;
  sending = true;
  problem = '';
  render();
  try {
    const response = await fetch(botUrl('/api/vote'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ poll: vote.id, map, token: token() }),
    });
    const body = await response.json().catch(() => ({}));
    if (body.vote !== undefined) apply(body.vote);
    if (body.result === 'counted' || body.result === 'changed') write(PICK_KEY, JSON.stringify({ poll: vote.id, map }));
    else problem = refusal(body.result);
  } catch {
    problem = 'Could not reach the vote. Try again.';
  }
  sending = false;
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
    if (!document.hidden && loaded && !sending) render();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}
