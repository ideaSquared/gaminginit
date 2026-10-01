import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  busiestHours,
  compact,
  emptyNote,
  formatDuration,
  formatHours,
  hourlyAverages,
  kd,
  latestMatches,
  mapKey,
  niceScale,
  peak,
  phaseRanges,
  playerCount,
  result,
  scoreLine,
  segments,
  serverState,
  STALE_MS,
  timeAgo,
  toLocalHours,
  vipDetail,
  vipOffer,
  BOARDS,
} from '../public/js/format.js';

const NOW = Date.UTC(2026, 8, 30, 12);
const stats = (server) => ({ thresholds: { seeding: 1, live: 20 }, server });
const server = (players, phase, seenAt = NOW - 30_000) => ({ name: 'UK #1', players, maxPlayers: 64, phase, seenAt });

describe('serverState', () => {
  it('says how many players the server needs while it seeds', () => {
    assert.deepEqual(serverState(stats(server(14, 'seeding')), NOW), {
      kind: 'seeding',
      label: 'Seeding',
      detail: '6 more players to go live. Jump in and help fill it.',
    });
    assert.match(serverState(stats(server(19, 'seeding')), NOW).detail, /^1 more player to go live/);
  });

  it('reports live and empty servers', () => {
    assert.equal(serverState(stats(server(40, 'live')), NOW).kind, 'live');
    assert.equal(serverState(stats(server(0, 'empty')), NOW).kind, 'empty');
  });

  it('calls the server offline once the bot has not read it for a few minutes', () => {
    const state = serverState(stats(server(40, 'live', NOW - STALE_MS - 60_000)), NOW);
    assert.equal(state.kind, 'offline');
    assert.equal(state.detail, 'Not responding. Last seen 4 min ago.');
  });

  it('waits when the bot has not read the server yet', () => {
    assert.equal(serverState(stats(null), NOW).kind, 'waiting');
    assert.equal(serverState(null, NOW).kind, 'waiting');
  });
});

describe('text', () => {
  it('formats times and durations', () => {
    assert.equal(timeAgo(20_000), 'just now');
    assert.equal(timeAgo(5 * 60_000), '5 min ago');
    assert.equal(timeAgo(3 * 3_600_000), '3 h ago');
    assert.equal(timeAgo(86_400_000), '1 day ago');
    assert.equal(formatDuration(42 * 60_000), '42 min');
    assert.equal(formatDuration(65 * 60_000), '1 h 05 min');
    assert.equal(formatDuration(120 * 60_000), '2 h');
    assert.equal(formatHours(45), '45 min');
    assert.equal(formatHours(312), '5.2 h');
    assert.equal(formatHours(900), '15 h');
  });

  it('formats counts and ratios', () => {
    assert.equal(compact(1284), '1,284');
    assert.equal(compact(12_900), '12.9K');
    assert.equal(compact(2_400_000), '2.4M');
    assert.equal(kd(9, 3), '3.00');
    assert.equal(kd(4, 0), '4.00');
  });

  it('names the winner, or a draw', () => {
    const scores = [
      { name: 'Kharr', score: 255 },
      { name: 'Valkyra', score: 300 },
    ];
    assert.deepEqual(result(scores), { winner: 'Valkyra', text: 'Valkyra won 300–255' });
    assert.equal(result([{ name: 'A', score: 5 }, { name: 'B', score: 5 }]).text, 'Draw 5–5');
    assert.equal(result([]), null);
    assert.equal(scoreLine(scores), 'Kharr 255–300 Valkyra');
    assert.equal(scoreLine([]), '');
  });

  it('names every faction when there are three', () => {
    const three = [
      { name: 'Kharr', score: 67 },
      { name: 'Valkyra', score: 100 },
      { name: 'Haldor', score: 41 },
    ];

    assert.deepEqual(result(three), { winner: 'Valkyra', text: 'Valkyra won 100, Kharr 67, Haldor 41' });
    assert.deepEqual(result([{ name: 'A', score: 9 }, { name: 'B', score: 9 }, { name: 'C', score: 2 }]), {
      winner: null,
      text: 'Draw: A 9, B 9, C 2',
    });
    assert.equal(scoreLine(three), 'Kharr 67 · Valkyra 100 · Haldor 41');
  });
});

describe('seeding', () => {
  it('gives the players for each server state', () => {
    assert.deepEqual(phaseRanges({ seeding: 1, live: 20 }), {
      empty: '0 players',
      seeding: '1–19 players',
      live: '20+ players',
    });
    assert.deepEqual(phaseRanges({ seeding: 3, live: 4 }), { empty: '0–2 players', seeding: '3 players', live: '4+ players' });
  });

  it('only says nobody is on when one player starts the seed', () => {
    assert.equal(emptyNote({ seeding: 1, live: 20 }), 'Nobody is on. The first player to join starts the seed.');
    assert.equal(emptyNote({ seeding: 3, live: 20 }), 'Fewer than 3 players on. Seeding starts once 3 are in.');
  });
});

describe('chart helpers', () => {
  it('finds the peak', () => {
    assert.equal(peak([[1, 4], [2, 31], [3, 12]]), 31);
    assert.equal(peak([]), 0);
  });

  it('breaks the line where readings are missing', () => {
    const minute = 60_000;
    const history = [[0, 1], [minute, 2], [10 * minute, 3], [11 * minute, 4]];
    assert.deepEqual(segments(history), [
      [[0, 1], [minute, 2]],
      [[10 * minute, 3], [11 * minute, 4]],
    ]);
  });

  it('picks round, whole-number axis ticks', () => {
    assert.deepEqual(niceScale(64), { max: 80, ticks: [0, 20, 40, 60, 80] });
    assert.deepEqual(niceScale(10), { max: 10, ticks: [0, 5, 10] });
    assert.deepEqual(niceScale(3), { max: 3, ticks: [0, 1, 2, 3] });
    assert.deepEqual(niceScale(0), { max: 1, ticks: [0, 1] });
  });
});

const vip = { seedDays: 3, seedMinutes: 10, windowDays: 7, lengthDays: 7 };

describe('seeder VIP', () => {
  it('says what seeding earns, from the bot’s rule', () => {
    assert.equal(vipOffer(vip), 'Seed on 3 days in a week and get a reserved slot for a week.');
    assert.equal(vipOffer({ ...vip, seedDays: 1, windowDays: 14 }), 'Seed on 1 day in 14 days and get a reserved slot for a week.');
    assert.match(vipDetail(vip), /^A day counts when you're on for more than 10 minutes while the server seeds, and it goes live\./);
  });

  it('mentions VIP in the server status while seeding or empty, only when the bot gives it', () => {
    const withVip = (s) => ({ ...stats(s), vip });

    assert.match(serverState(withVip(server(14, 'seeding')), NOW).detail, /help fill it\. Seeding earns VIP\.$/);
    assert.match(serverState(withVip(server(0, 'empty')), NOW).detail, /start the seed\. Seeding earns VIP\.$/);
    assert.doesNotMatch(serverState(withVip(server(30, 'live')), NOW).detail, /VIP/);
    assert.doesNotMatch(serverState(stats(server(14, 'seeding')), NOW).detail, /VIP/);
  });
});

describe('leaderboard boards', () => {
  const player = { name: 'Ash', seedingMinutes: 90, liveMinutes: 150, seedDays: 4, matches: 7, kills: 60, deaths: 24 };
  const cells = Object.fromEntries(BOARDS.map((b) => [b.key, b.cells(player)]));

  it('shows each board’s numbers', () => {
    assert.deepEqual(cells, {
      kills: ['60', '2.50'],
      kd: ['2.50', '60'],
      playtime: ['4.0 h', '7'],
      seeding: ['4', '1.5 h'],
    });
    assert.equal(BOARDS.find((b) => b.key === 'kd').sub({ kdMinMatches: 3 }), 'At least 3 matches.');
  });
});

describe('mapKey', () => {
  it('gives the three maps their colour key, whatever the case, and nothing to any other map', () => {
    assert.deepEqual(['Bakurani', 'OZETI', ' Zestafona '].map(mapKey), ['bakurani', 'ozeti', 'zestafona']);
    assert.equal(mapKey('Kavkazi'), null);
    assert.equal(mapKey(''), null);
    assert.equal(mapKey(undefined), null);
  });
});

describe('latestMatches', () => {
  it('puts the newest matches first and keeps only as many as asked for', () => {
    const matches = [1, 4, 2, 5, 3].map((endedAt) => ({ endedAt }));

    assert.deepEqual(latestMatches(matches, 3).map((m) => m.endedAt), [5, 4, 3]);
    assert.equal(latestMatches(matches, 10).length, 5);
    assert.deepEqual(matches.map((m) => m.endedAt), [1, 4, 2, 5, 3]);
    assert.deepEqual(latestMatches(undefined, 3), []);
  });
});

describe('busiest times', () => {
  const HOUR = 3_600_000;
  const utcHour = (at) => new Date(at).getUTCHours();

  it('averages the players in each hour of the day', () => {
    const day = Date.UTC(2026, 9, 1);
    const averages = hourlyAverages([[day + 19 * HOUR, 40], [day + 19.5 * HOUR, 50], [day + 20 * HOUR, 60]], utcHour);

    assert.equal(averages.length, 24);
    assert.equal(averages[19], 45);
    assert.equal(averages[20], 60);
    assert.equal(averages[3], null);
  });

  it('finds the busiest three hours in a row, across midnight too', () => {
    const evening = Array.from({ length: 24 }, (_, h) => (h >= 18 ? 40 + h : 5));
    assert.deepEqual(busiestHours(evening), { start: 21, length: 3, average: 62 });

    const late = Array.from({ length: 24 }, (_, h) => ([23, 0, 1].includes(h) ? 50 : 10));
    assert.deepEqual(busiestHours(late), { start: 23, length: 3, average: 50 });
  });

  it('moves the bot’s UTC hours to local hours', () => {
    const utc = Array.from({ length: 24 }, (_, h) => h * 10);

    assert.equal(toLocalHours(utc, -60)[20], 190);
    assert.equal(toLocalHours(utc, -60)[0], 230);
    assert.equal(toLocalHours(utc, 300)[0], 50);
    assert.equal(toLocalHours(utc, -330)[12], 60);
    assert.equal(toLocalHours([1], 0)[5], null);
  });

  it('skips runs with an hour that has no readings, and gives nothing when nobody played', () => {
    const gaps = Array(24).fill(null);
    gaps[10] = 30;
    gaps[14] = 12;
    gaps[15] = 12;
    gaps[16] = 12;
    assert.deepEqual(busiestHours(gaps), { start: 14, length: 3, average: 12 });
    gaps[15] = null;
    assert.equal(busiestHours(gaps), null);
    assert.equal(busiestHours(Array(24).fill(0)), null);
    assert.equal(busiestHours(Array(24).fill(null)), null);
  });

  it('says player or players', () => {
    assert.equal(playerCount(1), '1 player');
    assert.equal(playerCount(0), '0 players');
    assert.equal(playerCount(61), '61 players');
  });
});
