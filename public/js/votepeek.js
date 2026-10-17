import { demo } from './live.js';
import { botUrl, configured } from './session.js';
import { el, setText } from './views.js';
import { peekState, peekTitle, share, statusText, winnerOf } from './votemodel.js';

// The home page's next-map vote: a card under the server card, and a button in the hero, while a vote is open, and the
// map it chose for a while after. The vote is held in Discord (see vote.js); this only shows it and sends people there.

const $ = (id) => document.getElementById(id);

// Slower than the vote page: this is a nudge, not the place to watch the count.
const OPEN_MS = 10_000;
const IDLE_MS = 30_000;

// ?demo shows a sample vote, like the sample numbers.
const sample = (now) => ({
  id: 'demo',
  open: true,
  fromMap: 'Kavkazi',
  fromName: 'Bakurani',
  closesAt: now + 30 * 60_000,
  closeScore: 95,
  closedAt: null,
  options: [
    { map: 'A', name: 'Ozeti', votes: 9 },
    { map: 'B', name: 'Zestafona', votes: 5 },
    { map: 'C', name: 'Ardennes', votes: 2 },
    { map: 'D', name: 'Kamdesh', votes: 1 },
  ],
  total: 17,
  winner: null,
  infantryOnly: true,
  note: null,
  pending: false,
});

let vote = null;
let discord = null;
// What was drawn last, so the once-a-second countdown redraw and polling that changes nothing do not rebuild the list.
let drawn = '';

const render = () => {
  const now = Date.now();
  const state = peekState(vote, now);
  $('vote-peek').hidden = state === 'none';
  $('hero-vote').hidden = state !== 'open';
  $('hero-vote').parentElement.toggleAttribute('data-vote', state === 'open');
  if (state === 'none') {
    drawn = '';
    return;
  }
  const winner = winnerOf(vote);
  setText($('vote-peek-title'), peekTitle(vote, state));
  setText($('vote-peek-detail'), statusText(vote, now));
  // Voting is over: nothing to press.
  $('vote-peek-actions').hidden = state !== 'open';
  if (discord !== null) $('vote-peek-discord').href = discord;
  const key = JSON.stringify([vote.id, vote.options.map((o) => o.votes), winner]);
  if (key === drawn) return;
  drawn = key;
  $('vote-peek-list').replaceChildren(
    ...vote.options.map((o) => {
      const percent = share(o.votes, vote.total);
      const row = el(
        'li',
        { className: 'vote-peek-row' },
        el('span', { className: 'vote-name', textContent: o.name }),
        el('span', { className: 'vote-count', textContent: `${o.votes} ${o.votes === 1 ? 'vote' : 'votes'}` }),
        el('span', { className: 'vote-bar', 'aria-hidden': 'true' }, el('span', { className: 'vote-fill', style: `width: ${percent}%` })),
      );
      if (winner === o.map) row.dataset.winner = '';
      return row;
    }),
  );
};

const load = async () => {
  if (demo) {
    vote = sample(Date.now());
    return render();
  }
  try {
    const response = await fetch(botUrl('/api/vote'), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    vote = body.vote ?? null;
    discord = body.discord ?? null;
  } catch {
    // The card only appears when there is a vote to show: a bot without the vote, or one that can't be reached, shows none.
    vote = null;
  }
  render();
};

const tick = async () => {
  if (!document.hidden) await load();
  setTimeout(tick, vote?.open ? OPEN_MS : IDLE_MS);
};

if (configured || demo) {
  tick();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}
