// Loading live.js also shows the site-wide notice, keeps ?demo and similar on links, and scrolls the nav. The bot is the one
// the other pages read, so ?stats=… previews the vote too.
import { apiUrl } from './live.js';
import { canVote, choiceIn, errorText, voteOffer } from './accountmodel.js';
import { askBot, configured, loadPlayerToken, signInHref, takeResult } from './accountsession.js';
import { el, setText } from './views.js';
import { share, statusText, winnerOf } from './votemodel.js';

// The next-map vote page. Members vote with buttons in a Discord channel (see the bot's mapvote.ts); this page shows the
// same counts from GET /api/vote, refreshes them, and sends people to the channel. A player signed in with Discord (see
// account.js) who is in the server can vote here too: the options become buttons, and the vote is counted as the Discord
// buttons are, one per Discord account.

const $ = (id) => document.getElementById(id);

// Fast enough that the counts feel live; slower once the vote is over.
const OPEN_MS = 5_000;
const IDLE_MS = 30_000;

const voteUrl = apiUrl('/api/vote');

// A sign-in that just came back to this page (the bot sends the browser back after Discord): keeps the session.
const arrived = takeResult();

let vote = null;
let discord = null;
let loaded = false;
// The signed-in player as the bot sees them (GET /api/account), or null. `account.ballot` is their vote in the open vote.
let account = null;
let accountAt = 0;
let busy = false;
// What the last press did, in words.
let reply = arrived.error === undefined ? '' : errorText(arrived.error);
// What the screen reader was last told, so it hears the vote open, close and end but not every count and tick.
let announced = '';

// One option: a bar with its votes, and a button to vote for it when `choice` ({ kind, key }) says this player can.
const optionRow = (name, votes, total, choice) => {
  const percent = share(votes, total);
  const parts = [
    el('span', { className: 'vote-name', textContent: name }),
    el('span', { className: 'vote-count', textContent: `${votes} ${votes === 1 ? 'vote' : 'votes'} · ${percent}%` }),
    el('span', { className: 'vote-bar', 'aria-hidden': 'true' }, el('span', { className: 'vote-fill', style: `width: ${percent}%` })),
  ];
  if (choice === null) return el('div', { className: 'vote-option' }, ...parts);
  const mine = choiceIn(account.ballot, vote, choice.kind) === choice.key;
  const button = el('button', { type: 'button', className: 'vote-option', disabled: busy }, ...parts);
  button.setAttribute('aria-pressed', String(mine));
  button.setAttribute('aria-label', `${mine ? 'Your vote: ' : 'Vote for '}${name}`);
  if (mine) button.dataset.mine = '';
  button.addEventListener('click', () => cast(choice));
  return button;
};

// Under the options: how to vote here, for someone who cannot yet. Nothing once they can, or when there is nothing to vote on.
const renderSignIn = (open) => {
  const box = $('vote-signin');
  const offer = open && configured ? voteOffer(account) : null;
  box.hidden = offer === null;
  if (offer === null) return;
  box.replaceChildren(
    offer === 'sign-in' ? 'Vote right here: ' : 'You are signed in but not in the Discord yet. Join to vote here: ',
    ...(offer === 'sign-in'
      ? [
          el('a', { className: 'btn btn-discord btn-small', href: signInHref(), textContent: 'Sign in with Discord' }),
          el('a', { className: 'btn btn-ghost btn-small', href: signInHref({ join: true }), textContent: 'Sign in and join' }),
        ]
      : [el('a', { className: 'btn btn-discord btn-small', href: signInHref({ join: true }), textContent: 'Join the Discord' })]),
  );
};

// A press on an option: the bot counts it as a press of the same button in Discord, and answers with the vote as it is.
const cast = async ({ kind, key }) => {
  if (busy || vote === null) return;
  busy = true;
  render();
  const { status, data } = await askBot('/api/account/vote', { method: 'POST', body: { poll: vote.id, [kind]: key } });
  busy = false;
  if (status === 200 && data !== null) {
    reply = data.reply;
    if (data.vote) vote = data.vote;
    account = { ...account, ballot: { poll: vote.id, ...data.mine } };
  } else if (status === 403 && data?.code === 'not-member') {
    account = { ...account, member: false };
    reply = data.error;
  } else if (status === 401) {
    account = null;
    reply = 'You were signed out. Sign in again to vote.';
  } else {
    reply = data?.error ?? 'Could not count that vote just now. Try again.';
  }
  render();
};

const loadAccount = async () => {
  if (!configured || loadPlayerToken() === null) {
    account = null;
    return;
  }
  const { status, data } = await askBot('/api/account');
  accountAt = Date.now();
  if (status === 200 && data !== null) account = data;
  else if (status === 401) account = null;
};

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
  const voting = canVote(account, vote, now);
  $('vote-options').replaceChildren(
    ...(vote?.options ?? []).map((o) => {
      const row = optionRow(o.name, o.votes, vote.total, voting ? { kind: 'map', key: o.map } : null);
      if (winner === o.map) row.dataset.winner = '';
      return row;
    }),
  );
  // The conditions vote, when the bot has one: its own share, of the votes on the conditions.
  const conditions = vote?.conditions ?? [];
  const conditionVotes = conditions.reduce((sum, c) => sum + c.votes, 0);
  $('vote-conditions').hidden = conditions.length === 0;
  $('vote-conditions-list').replaceChildren(
    ...conditions.map((c) => optionRow(c.label, c.votes, conditionVotes, voting ? { kind: 'light', key: c.key } : null)),
  );
  renderSignIn(open);
  setText($('vote-reply'), reply);
  // The way in: the channel when the bot knows it, else the community's Discord invite already on every page.
  const link = $('vote-discord');
  link.hidden = vote === null || !open;
  if (discord !== null) link.href = discord;
};

const load = async () => {
  try {
    const response = await fetch(voteUrl, { headers: { accept: 'application/json' } });
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

// A signed-in player's own vote can change in Discord too, so it is asked for again now and then.
const ACCOUNT_MS = 60_000;

const tick = async () => {
  if (!document.hidden) {
    await load();
    if (account !== null && Date.now() - accountAt >= ACCOUNT_MS) {
      await loadAccount();
      render();
    }
  }
  setTimeout(tick, vote?.open ? OPEN_MS : IDLE_MS);
};

if (voteUrl === '') {
  setText($('vote-status'), 'The vote is not connected yet.');
} else {
  loadAccount().then(() => {
    if (arrived.join === 'added') reply = 'You are in the Discord. You can vote now.';
    render();
  });
  tick();
  // The countdown moves every second without asking the bot.
  setInterval(() => {
    if (!document.hidden && loaded) render();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}
