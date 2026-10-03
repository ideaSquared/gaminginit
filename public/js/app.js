import { compact, isOnline, scoreLine, serverState, timeAgo, vipOffer } from './format.js';
import { keepQuery, startLive } from './live.js';
import { el, mapTag, setText } from './views.js';

// The home page: the server card, the Discord count and links to the other pages.

// The home page used to hold these sections. Old links to them, like /#leaderboard, go to their own pages now.
const MOVED = {
  stats: 'stats',
  matches: 'matches',
  leaderboard: 'leaderboard',
  weapons: 'leaderboard#weapons',
  seeding: 'join#seeding',
  join: 'join',
  vip: 'join#vip',
};
const redirect = () => {
  const moved = MOVED[location.hash.slice(1)];
  if (moved) location.replace(keepQuery(moved));
  return Boolean(moved);
};
// Also when one is opened while the home page is already open.
addEventListener('hashchange', redirect);
const moved = redirect();

const $ = (id) => document.getElementById(id);

let stats = null;

const renderServer = (now) => {
  const state = serverState(stats, now);
  const server = stats?.server ?? null;
  const online = server !== null && isOnline(state);

  const status = $('server-status');
  status.dataset.kind = state.kind;
  setText(status.querySelector('.status-label'), state.label);
  $('server').dataset.kind = state.kind;
  setText($('server-detail'), state.detail);
  $('server-help').hidden = state.kind !== 'seeding' && state.kind !== 'empty';
  setText($('server-name'), server?.name ?? 'Game server');
  setText($('server-updated'), server ? `Updated ${timeAgo(now - server.seenAt)}` : '');
  setText($('players-now'), online ? String(server.players) : '–');
  setText($('players-max'), server ? `/ ${server.maxPlayers} players` : '');
  $('server-map').replaceChildren(online && server.map ? mapTag(server.map) : '–');
  setText($('server-score'), (online && scoreLine(server.factionScores)) || '–');

  const meter = $('players-meter');
  const max = server?.maxPlayers || 1;
  const players = online ? server.players : 0;
  meter.setAttribute('aria-valuemax', String(max));
  meter.setAttribute('aria-valuenow', String(players));
  meter.setAttribute('aria-valuetext', online ? `${players} of ${max} players` : 'No reading');
  meter.style.setProperty('--fill', String(Math.min(players / max, 1)));
  meter.style.setProperty('--mark', String(Math.min((stats?.thresholds.live ?? 0) / max, 1)));
  meter.classList.toggle('no-mark', !server);
};

const renderDiscord = () => {
  const discord = stats?.discord;
  const line = $('discord-count');
  line.hidden = !discord;
  if (!discord) return;
  line.replaceChildren(
    el('strong', { textContent: compact(discord.members) }),
    ' members · ',
    el('span', { className: 'online-dot', ariaHidden: 'true' }),
    el('strong', { textContent: compact(discord.online) }),
    ' online now',
  );
};

// What seeding earns, when the bot gives seeders VIP. The join page says how.
const renderVip = () => {
  const vip = stats?.vip ?? null;
  $('vip-cta').hidden = !vip;
  if (vip) setText($('vip-cta-text'), vipOffer(vip));
};

if (!moved) {
  startLive((latest) => {
    stats = latest;
    renderServer(Date.now());
    renderDiscord();
    renderVip();
  });

  // Keep "updated 2 min ago" honest between fetches.
  setInterval(() => {
    if (!document.hidden) renderServer(Date.now());
  }, 15_000);
}
