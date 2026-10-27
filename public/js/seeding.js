import { BOARDS, boardRows, coinsOffer, emptyNote, phaseRanges, vipOffer } from './format.js';
import { serverArt, vipTicketArt } from './art-info.js';
import { keepQuery, startLive } from './live.js';
import { boardTable, el, playerName, setText } from './views.js';

// The seeding page: what seeding is, in the bot's own numbers, then our top seeders and who has seeder VIP.

const $ = (id) => document.getElementById(id);

const SEEDERS = BOARDS.find((board) => board.key === 'seeding');

// When a player's VIP ends, in the reader's own time: "Fri 10 Oct".
const until = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Uses the bot's own thresholds, so the explanation stays right if they change. Until the stats load, the page shows
// the bot's defaults.
const renderSeeding = (stats) => {
  $('seed-vip').hidden = !stats?.vip && !stats?.coins;
  // While INITcoins are on, seeding pays coins instead of a whitelist slot.
  if (stats?.coins) {
    setText($('seed-vip-text'), `${coinsOffer(stats.coins)} A week of whitelist is ${stats.coins.vipWeek}.`);
    setText($('seed-vip-link'), 'How INITcoins work');
    $('seed-vip-link').href = keepQuery('coins');
  } else {
    // A refresh can change which one the bot gives: put the seeder VIP wording back.
    setText($('seed-vip-text'), 'Seeding also earns a whitelist slot.');
    setText($('seed-vip-link'), 'How seeder VIP works');
    $('seed-vip-link').href = keepQuery('./#vip');
  }
  if (!stats?.thresholds) return;
  const ranges = phaseRanges(stats.thresholds);
  for (const kind of ['empty', 'seeding', 'live']) setText($(`range-${kind}`), ranges[kind]);
  setText($('note-empty'), emptyNote(stats.thresholds));
  setText($('seed-live'), String(stats.thresholds.live));
};

// The top seeders of the last week, which the bot works out apart from the leaderboard's month.
const renderTopSeeders = (stats) => {
  const root = $('top-seeders');
  const seeders = stats?.recentSeeders;
  if (!seeders) {
    const message = stats ? 'The top seeders appear once the bot keeps player records.' : 'Waiting for live stats.';
    root.replaceChildren(el('p', { className: 'muted', textContent: message }));
    return;
  }
  setText($('top-seeders-sub'), `Time on the server before it went live, over the last ${seeders.days} days (UTC days).`);
  const rows = boardRows(SEEDERS, { seeding: seeders.rows });
  root.replaceChildren(rows.length > 0 ? boardTable(SEEDERS, rows) : el('p', { className: 'muted board-empty', textContent: 'Nobody yet.' }));
};

// Who has VIP from seeding now, when the bot gives seeders VIP and says who has it.
const renderVipHolders = (stats) => {
  const holders = stats?.vip && Array.isArray(stats.seederVip) ? stats.seederVip : null;
  $('vip-holders').hidden = holders === null;
  if (holders === null) return;
  setText($('vip-holders-sub'), vipOffer(stats.vip));
  $('vip-holders-list').replaceChildren(
    holders.length === 0
      ? el('p', { className: 'muted board-empty', textContent: 'Nobody has it right now. Be the first.' })
      : el(
          'table',
          { className: 'players-table vip-table' },
          el('thead', {}, el('tr', {}, ...['Player', 'VIP until'].map((h) => el('th', { scope: 'col', textContent: h })))),
          el(
            'tbody',
            {},
            ...holders.map((p) =>
              el('tr', {}, el('td', { className: 'player' }, playerName(p)), el('td', { textContent: until.format(p.until) })),
            ),
          ),
        ),
  );
};

// The server picture in each state's card, and the VIP ticket by the VIP note.
for (const kind of ['empty', 'seeding', 'live']) {
  const card = document.querySelector(`.phase[data-kind="${kind}"]`);
  const art = serverArt(kind);
  art.classList.add('phase-art');
  card?.prepend(art);
}
$('seed-vip').prepend(vipTicketArt());

startLive((stats) => {
  renderSeeding(stats);
  renderTopSeeders(stats);
  renderVipHolders(stats);
});
