// Loading live.js also shows the site-wide notice and keeps ?demo and similar on links. The bot is the one
// the other pages read, so ?stats=… previews the vote too.
import { apiUrl } from './live.js';
import { canVote, choiceIn, errorText, voteOffer } from './accountmodel.js';
import { askBot, configured, loadPlayerToken, signInHref, takeResult } from './accountsession.js';
import { mapKey } from './format.js';
import { el, setText } from './views.js';
import { countdown, scoreRows, share, statusText, winnerOf } from './votemodel.js';
import { conditionIcon, mapArt } from './voteart.js';

// The next-map vote page. Members vote with buttons in a Discord channel (see the bot's mapvote.ts); this page shows the
// same counts from GET /api/vote, refreshes them, and sends people to the channel. A player signed in with Discord (see
// account.js) who is in the server can vote here too: the options become buttons, and the vote is counted as the Discord
// buttons are, one per Discord account.

const $ = (id) => document.getElementById(id);

// Fast enough that the counts feel live; slower once the vote is over.
const OPEN_MS = 5_000;
const IDLE_MS = 30_000;

const voteUrl = apiUrl('/api/vote');
const statsUrl = apiUrl('/api/stats');

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

// The rows of one list of options. Each is a bar with its votes, and a button to vote for it when the player can. They are built
// once and then changed in place: the page refreshes every few seconds and counts down every second, and drawing the buttons
// again each time would drop the keyboard focus (and the screen reader's place) from whoever is choosing. Only when the options
// themselves change, or a row turns into a button or back, are they drawn again, and focus goes back to the same choice.
const buildRow = (row) => {
  const node = el(
    row.press ? 'button' : 'div',
    { className: `vote-option vote-option-${row.kind}` },
    row.kind === 'map' ? mapArt(row.id, row.name) : conditionIcon(row.id),
    el('span', { className: 'vote-name' }),
    el('span', { className: 'vote-count' }),
    el('span', { className: 'vote-bar' }, el('span', { className: 'vote-fill' })),
  );
  node.dataset.key = row.key;
  const colour = row.kind === 'map' ? mapKey(row.name) : null;
  if (colour !== null) node.dataset.map = colour;
  node.querySelector('.vote-bar').setAttribute('aria-hidden', 'true');
  if (row.press) {
    node.type = 'button';
    node.addEventListener('click', row.press);
  }
  return node;
};

const updateRow = (node, row) => {
  const percent = share(row.votes, row.total);
  setText(node.querySelector('.vote-name'), row.name);
  setText(node.querySelector('.vote-count'), `${row.votes} ${row.votes === 1 ? 'vote' : 'votes'} · ${percent}%`);
  const fill = node.querySelector('.vote-fill');
  if (fill.style.width !== `${percent}%`) fill.style.width = `${percent}%`;
  node.toggleAttribute('data-winner', row.winner === true);
  node.toggleAttribute('data-leading', row.leading === true);
  if (row.press) {
    node.toggleAttribute('data-mine', row.mine);
    node.setAttribute('aria-pressed', String(row.mine));
    node.setAttribute('aria-label', `${row.mine ? 'Your vote: ' : 'Vote for '}${row.name}`);
    // Not `disabled`, which would take the focus from the button just pressed.
    node.setAttribute('aria-busy', String(busy));
  }
};

const syncRows = (list, rows) => {
  const have = [...list.children];
  const same = have.length === rows.length && have.every((n, i) => n.dataset.key === rows[i].key && (n.tagName === 'BUTTON') === Boolean(rows[i].press));
  if (!same) {
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
    list.replaceChildren(...rows.map(buildRow));
    if (focused !== undefined) [...list.children].find((n) => n.dataset.key === focused && n.tagName === 'BUTTON')?.focus({ preventScroll: true });
  }
  [...list.children].forEach((node, i) => updateRow(node, rows[i]));
};

// What a row needs: `voting` says whether this player can vote, and `kind` is the map, the time of day ('light') or the weather ('weather').
const rowsFor = (items, kind, total, voting, winner = null) => {
  const top = Math.max(0, ...items.map((item) => item.votes));
  return items.map((item) => {
    const key = kind === 'map' ? item.map : item.key;
    return {
      key: `${kind}:${key}`,
      kind: kind === 'map' ? 'map' : 'cond',
      id: key,
      name: kind === 'map' ? item.name : item.label,
      votes: item.votes,
      total,
      winner: winner !== null && winner === key,
      leading: top > 0 && item.votes === top,
      mine: choiceIn(account?.ballot, vote, kind) === key,
      press: voting ? () => cast({ kind, key }) : null,
    };
  });
};

// Under the options: how to vote here, for someone who cannot yet. Nothing once they can, or when there is nothing to vote on.
// Drawn again only when what it offers changes, so the links keep the focus.
let offered = null;
const renderSignIn = (open) => {
  const box = $('vote-signin');
  const offer = open && configured ? voteOffer(account) : null;
  box.hidden = offer === null;
  if (offer === offered) return;
  offered = offer;
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

// Whether the last full draw had the vote open: when its time runs out the page is drawn again, and until then the countdown
// only changes its words.
let wasOpen = null;

// The live match's team scores (from /api/stats), for the bars towards the score that closes the vote.
let scores = [];

// One row per team: its score out of the close score, as a bar. Drawn again only when a score changes.
let scoresShown = '';
const renderScores = (open) => {
  const box = $('vote-scores');
  const rows = open ? scoreRows(scores, vote.closeScore) : [];
  box.hidden = rows.length === 0;
  const key = `${vote?.closeScore}:${rows.map((r) => `${r.name}=${r.score}`).join(',')}`;
  if (key === scoresShown) return;
  scoresShown = key;
  box.replaceChildren(
    el('p', { className: 'vote-scores-title', textContent: 'Match score, vote closes at the close score' }),
    ...rows.map((r) =>
      el(
        'div',
        { className: 'vote-score' },
        el('span', { className: 'vote-score-name', textContent: r.name }),
        el('span', { className: 'vote-score-num', textContent: `${r.score} / ${vote.closeScore}` }),
        el('span', { className: 'vote-score-bar' }, Object.assign(el('span', { className: 'vote-score-fill' }), { style: `width: ${r.percent}%` })),
      ),
    ),
  );
};

const loadScores = async () => {
  if (statsUrl === '') return;
  try {
    const response = await fetch(statsUrl, { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const body = await response.json();
    scores = Array.isArray(body?.server?.factionScores) ? body.server.factionScores : [];
  } catch {
    // The bars are left as they were.
  }
};

// The clock under the status: the time left until the vote closes at the latest. Hidden once it is over.
const updateTimer = (now) => {
  const open = vote !== null && vote.open && now < vote.closesAt;
  $('vote-timer').hidden = !open;
  if (!open) return;
  setText($('vote-timer-time'), countdown(vote.closesAt, now));
  $('vote-timer').toggleAttribute('data-low', vote.closesAt - now < 60_000);
};

const render = () => {
  const now = Date.now();
  const open = vote !== null && vote.open && now < vote.closesAt;
  wasOpen = open;
  const status = loaded ? statusText(vote, now) : 'Loading the vote…';
  setText($('vote-status'), status);
  updateTimer(now);
  renderScores(open);
  if (loaded) {
    const phase = vote === null ? 'none' : open ? `open:${vote.id}` : `over:${vote.id}:${vote.winner?.map ?? ''}:${vote.pending}`;
    if (phase !== announced) {
      announced = phase;
      // The countdown is left out: it changes every second.
      setText($('vote-announce'), open ? `A vote is open for the map after ${vote.fromName}.` : status);
    }
  }
  const voting = canVote(account, vote, now);
  syncRows($('vote-options'), rowsFor(vote?.options ?? [], 'map', vote?.total ?? 0, voting, winnerOf(vote)));
  // The time of day and weather votes, when the bot has them: each its own share, of the votes on it.
  for (const [kind, section, items] of [
    ['light', 'vote-conditions', vote?.conditions ?? []],
    ['weather', 'vote-weather', vote?.weather ?? []],
  ]) {
    $(section).hidden = items.length === 0;
    syncRows($(`${section}-list`), rowsFor(items, kind, items.reduce((sum, c) => sum + c.votes, 0), voting));
  }
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
    if (vote?.open) {
      await loadScores();
      render();
    }
    // Also when the first ask failed (the bot was down for a moment) and there is no account yet.
    if (configured && loadPlayerToken() !== null && Date.now() - accountAt >= ACCOUNT_MS) {
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
  // The countdown moves every second without asking the bot, and without drawing the options again.
  setInterval(() => {
    if (document.hidden || !loaded) return;
    const now = Date.now();
    if ((vote !== null && vote.open && now < vote.closesAt) !== wasOpen) render();
    else {
      setText($('vote-status'), statusText(vote, now));
      updateTimer(now);
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}
