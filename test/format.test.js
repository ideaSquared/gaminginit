import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  busyRuns,
  busyShares,
  compact,
  emptyNote,
  formatDuration,
  formatHours,
  hourlyAverages,
  isOnline,
  kd,
  latestMatches,
  mapSegments,
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
  bests,
  byMap,
  bySide,
  calendarWeeks,
  contrast,
  readableColour,
  sideColours,
  daysAgo,
  heatLevel,
  inPeriod,
  ordinal,
  percent,
  results,
  searchPlayers,
  seedProgress,
  streaks,
  sumDays,
  topRanks,
  longestKill,
  metres,
  WEAPON_KINDS,
  weaponTotals,
  DEATH_TAGS,
  liveState,
  multiKill,
  shortAgo,
  flagLabel,
  flagRule,
  MOD_ACTIONS,
  sessionExpiry,
  signInResult,
  SIGN_IN_ERRORS,
  staffBy,
  staffLabel,
  withVehicle,
  steamFlagLabel,
  steamFlagRule,
  RISK_LABELS,
  longAgo,
  steamWhy,
  accountAge,
  headshotShare,
  discordParts,
  optionLabel,
  READ_ONLY_TOOLS,
  toolsFrom,
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

  it('counts the server as online unless it is waiting or offline', () => {
    assert.equal(isOnline(serverState(stats(server(40, 'live')), NOW)), true);
    assert.equal(isOnline(serverState(stats(server(14, 'seeding')), NOW)), true);
    assert.equal(isOnline(serverState(stats(server(0, 'empty')), NOW)), true);
    assert.equal(isOnline(serverState(stats(server(40, 'live', NOW - STALE_MS - 60_000)), NOW)), false);
    assert.equal(isOnline(serverState(null, NOW)), false);
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

  it('gives the share of each hour’s readings with at least the busy threshold', () => {
    const day = Date.UTC(2026, 9, 1);
    const history = [[day + 20 * HOUR, 98], [day + 20.25 * HOUR, 97], [day + 20.5 * HOUR, 96], [day + 20.75 * HOUR, 90]];
    const shares = busyShares([...history, [day + 21 * HOUR, 40]], 97, utcHour);

    assert.equal(shares[20], 0.5);
    assert.equal(shares[21], 0);
    assert.equal(shares[3], null);
  });

  it('finds the busy hours, at least half the time, as runs across midnight too', () => {
    const shares = Array(24).fill(0);
    shares[13] = 0.5;
    shares[19] = 0.6;
    shares[20] = 0.9;
    shares[21] = 0.7;
    shares[22] = 0.49;
    assert.deepEqual(busyRuns(shares), [
      { start: 13, length: 1 },
      { start: 19, length: 3 },
    ]);

    const late = Array.from({ length: 24 }, (_, h) => ([23, 0, 1].includes(h) ? 0.8 : null));
    assert.deepEqual(busyRuns(late), [{ start: 23, length: 3 }]);
    assert.deepEqual(busyRuns(Array(24).fill(1)), [{ start: 0, length: 24 }]);
  });

  it('moves the bot’s UTC hours to local hours', () => {
    const utc = Array.from({ length: 24 }, (_, h) => h * 10);

    assert.equal(toLocalHours(utc, -60)[20], 190);
    assert.equal(toLocalHours(utc, -60)[0], 230);
    assert.equal(toLocalHours(utc, 300)[0], 50);
    assert.equal(toLocalHours(utc, -330)[12], 60);
    assert.equal(toLocalHours([1], 0)[5], null);
  });

  it('gives no busy hours when none is busy at least half the time', () => {
    assert.deepEqual(busyRuns(Array(24).fill(0.49)), []);
    assert.deepEqual(busyRuns(Array(24).fill(null)), []);
  });

  it('says player or players', () => {
    assert.equal(playerCount(1), '1 player');
    assert.equal(playerCount(0), '0 players');
    assert.equal(playerCount(61), '61 players');
  });
});

describe('player pages', () => {
  const day = (date, values = {}) => ({ day: date, seedingMinutes: 0, liveMinutes: 60, seedDays: 0, matches: 1, kills: 5, deaths: 5, ...values });
  const match = (endedAt, values = {}) => ({
    map: 'Ozeti',
    endedAt,
    durationMs: 45 * 60_000,
    kills: 10,
    deaths: 5,
    place: 4,
    players: 60,
    faction: 'Valkyra',
    result: 'won',
    factionScores: [],
    ...values,
  });

  it('says 1st, 2nd, 3rd and the teens', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), [
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ]);
  });

  it('keeps the days and matches inside the period, by UTC day', () => {
    const profile = {
      activity: [day('2026-08-01'), day('2026-09-01'), day('2026-09-30')],
      matches: [match(NOW), match(Date.UTC(2026, 8, 1, 23, 30)), match(Date.UTC(2026, 7, 31, 23, 30))],
    };
    const period = inPeriod(profile, 30, NOW);

    assert.deepEqual(period.activity.map((d) => d.day), ['2026-09-01', '2026-09-30']);
    assert.equal(period.matches.length, 2);
  });

  it('adds up days', () => {
    assert.deepEqual(sumDays([day('2026-09-29', { seedingMinutes: 20, seedDays: 1 }), day('2026-09-30', { kills: 7 })]), {
      days: 2,
      seedingMinutes: 20,
      liveMinutes: 120,
      seedDays: 1,
      matches: 2,
      kills: 12,
      deaths: 10,
    });
  });

  it('counts wins over the matches whose result is known', () => {
    const list = [match(1), match(2, { result: 'lost' }), match(3, { result: 'draw' }), match(4, { result: null }), match(5)];

    assert.deepEqual(results(list), { won: 2, lost: 1, draw: 1, decided: 4, share: 0.5 });
    assert.equal(results([match(1, { result: null })]).share, null);
    assert.equal(percent(0.666), '67%');
    assert.equal(percent(null), '–');
  });

  it('breaks matches down by map, most played first', () => {
    const maps = byMap([match(1, { map: 'Bakurani', kills: 3 }), match(2), match(3, { kills: 20, result: 'lost' })]);

    assert.deepEqual(
      maps.map((m) => [m.map, m.matches, m.won, m.kills, m.best.kills]),
      [
        ['Ozeti', 2, 1, 30, 20],
        ['Bakurani', 1, 1, 3, 3],
      ],
    );
  });

  it('breaks matches down by side, however the server spelled it, leaving out matches without one', () => {
    const sides = bySide([match(3, { faction: 'Lone Star' }), match(2, { faction: 'LONESTAR', result: 'lost' }), match(1), match(0, { faction: null })]);

    assert.deepEqual(
      sides.map((s) => [s.faction, s.matches, s.won]),
      [
        ['Lone Star', 2, 1],
        ['Valkyra', 1, 1],
      ],
    );
  });

  it('finds their best match and day, and counts MVPs and top-3 finishes', () => {
    const list = [
      match(4, { kills: 12, deaths: 1, place: 2 }),
      match(3, { kills: 3, deaths: 0, place: 1 }),
      match(2, { kills: 20, deaths: 10, place: 1 }),
      match(1, { kills: 20, deaths: 2, place: 9 }),
      match(0, { kills: 0, deaths: 3, place: 1 }),
    ];
    const best = bests(list, [day('2026-09-29', { kills: 40 }), day('2026-09-30', { kills: 41 })]);

    // A tie goes to the earlier match; the K/D needs 5 kills, so 3 kills and no deaths is not a record.
    assert.equal(best.kills.endedAt, 1);
    assert.equal(best.kd.endedAt, 4);
    assert.equal(best.day.day, '2026-09-30');
    assert.equal(best.mvps, 2);
    assert.equal(best.podiums, 3);
    assert.deepEqual(bests([], []), { kills: null, kd: null, day: null, mvps: 0, podiums: 0 });
  });

  it('counts days in a row, keeping a streak alive until today is over', () => {
    const activity = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-27', '2026-09-28', '2026-09-29'].map((d) => day(d));

    assert.deepEqual(streaks(activity, '2026-09-30'), { current: 3, longest: 4 });
    assert.deepEqual(streaks(activity, '2026-10-01'), { current: 0, longest: 4 });
    assert.deepEqual(streaks([...activity, day('2026-09-30')], '2026-09-30'), { current: 4, longest: 4 });
    assert.deepEqual(streaks([], '2026-09-30'), { current: 0, longest: 0 });
  });

  it('lays the calendar out in weeks from Monday, with no days after today or before the first', () => {
    // 2026-10-01 is a Thursday.
    const weeks = calendarWeeks('2026-10-01', 2, '2026-09-23');

    assert.deepEqual(weeks, [
      [null, null, '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'],
      ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', null, null, null],
    ]);
    assert.equal(calendarWeeks('2026-10-01', 13, '2026-01-01').length, 13);
  });

  it('shades a calendar day by time played', () => {
    assert.deepEqual([0, 1, 29, 30, 89, 90, 179, 180, 600].map(heatLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('says how long ago a day was', () => {
    assert.equal(daysAgo('2026-09-30', '2026-09-30'), 'Today');
    assert.equal(daysAgo('2026-09-29', '2026-09-30'), 'Yesterday');
    assert.equal(daysAgo('2026-09-20', '2026-09-30'), '10 days ago');
  });

  it('words seeder VIP progress from the bot’s rule', () => {
    const rule = { seedDays: 3, seedMinutes: 10, windowDays: 7, lengthDays: 7 };

    assert.equal(seedProgress({ rule, seedDays: 1 }), '1 of 3 seed days in the last 7 days. 2 more earns a reserved slot.');
    assert.equal(seedProgress({ rule, seedDays: 3 }), '3 seed days in the last 7 days. That earns a reserved slot.');
    assert.equal(
      seedProgress({ rule, seedDays: 0 }, true),
      'No seed days in the last 7 days yet. Seeding on 3 days in a week keeps the reserved slot for another week.',
    );
  });

  it('keeps a side’s colour when it reads well on the cards, and lightens it until it does', () => {
    const surface = [0x13, 0x16, 0x1b];
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

    assert.equal(readableColour('#ff3333'), '#ff3333');
    assert.equal(readableColour('#3366ffff'), readableColour('#3366ff'));
    for (const hex of ['#3366ff', '#000000', '#5a1010']) assert.ok(contrast(rgb(readableColour(hex)), surface) >= 4.5, hex);
    assert.equal(readableColour(undefined), null);
    assert.equal(readableColour('blue'), null);
  });

  it('takes each side’s colour from its latest match, however the server spelled it', () => {
    const colours = sideColours([
      match(2, { factionScores: [{ name: 'LONESTAR', score: 100, colorHex: '#ff3333' }, { name: 'Valkyra', score: 50 }] }),
      match(1, { factionScores: [{ name: 'Lone Star', score: 100, colorHex: '#ffaa00' }] }),
    ]);

    assert.equal(colours.get('lonestar'), '#ff3333');
    assert.equal(colours.has('valkyra'), false);
  });

  it('lists the leaderboard places in the top 10, best first', () => {
    const ranks = { days: 30, players: 200, kills: 4, kd: null, playtime: 11, seeding: 1 };

    assert.deepEqual(topRanks(ranks).map((r) => r.text), ['#1 seeder', '#4 in kills']);
    assert.deepEqual(topRanks(undefined), []);
  });

  it('finds players by any part of their name, ignoring case and accents, names that start with it first', () => {
    const players = [{ name: 'Bravo_Six' }, { name: 'Sable' }, { name: 'Ébène' }, { name: 'Moth' }];

    assert.deepEqual(searchPlayers(players, 'b').map((p) => p.name), ['Bravo_Six', 'Sable', 'Ébène']);
    assert.deepEqual(searchPlayers(players, 'e').map((p) => p.name), ['Ébène', 'Sable']);
    assert.deepEqual(searchPlayers(players, ' EBE ').map((p) => p.name), ['Ébène']);
    assert.deepEqual(searchPlayers(players, ''), players);
    assert.deepEqual(searchPlayers(players, 'zz'), []);
  });
});

describe('weapons', () => {
  const used = [
    { day: '2026-09-01', name: 'AK74', kind: 'weapon', kills: 30, headshots: 9, longest: 900 },
    { day: '2026-09-20', name: 'AK74', kind: 'weapon', kills: 4, headshots: 1, longest: 61.2 },
    { day: '2026-09-20', name: 'Humvee', kind: 'vehicle', kills: 5, headshots: 0, longest: null },
    { day: '2026-09-29', name: 'AK74', kind: 'weapon', kills: 2, headshots: 2, longest: 140.5 },
    { day: '2026-09-29', name: 'SVD', kind: 'weapon', kills: 6, headshots: 3, longest: null },
  ];

  it('writes distances in metres, to a tenth under 10 m', () => {
    assert.equal(metres(4.53), '4.5 m');
    assert.equal(metres(4), '4 m');
    assert.equal(metres(612.3), '612 m');
    assert.equal(metres(1204.6), '1,205 m');
  });

  it('adds up a player’s weapons over the days from the first one asked for, most kills first', () => {
    assert.deepEqual(weaponTotals(used, '2026-09-10'), [
      { name: 'AK74', kind: 'weapon', kills: 6, headshots: 3, longest: 140.5 },
      { name: 'SVD', kind: 'weapon', kills: 6, headshots: 3, longest: null },
      { name: 'Humvee', kind: 'vehicle', kills: 5, headshots: 0, longest: null },
    ]);
    assert.equal(weaponTotals(used, '2026-08-01')[0].kills, 36);
    assert.deepEqual(weaponTotals(undefined, '2026-09-10'), []);
  });

  it('finds their longest kill, and what with', () => {
    assert.deepEqual(longestKill(weaponTotals(used, '2026-09-10')), { distance: 140.5, weapon: 'AK74' });
    assert.equal(longestKill(weaponTotals(used.slice(2, 3), '2026-09-10')), null);
  });

  it('labels the weapons that are not carried by hand', () => {
    assert.equal(WEAPON_KINDS.weapon, undefined);
    assert.equal(WEAPON_KINDS['vehicle-weapon'], 'Vehicle gun');
  });
});

describe('live page', () => {
  const server = { name: 'UK #1', players: 40, maxPlayers: 100, map: 'Ozeti', phase: 'live', factionScores: [], seenAt: NOW - 20_000 };
  const snapshot = (overrides) => ({ generatedAt: NOW, feed: true, server, currentMatch: { map: 'Ozeti', top: [] }, match: null, ...overrides });

  it('names kills close together', () => {
    assert.deepEqual([1, 2, 3, 4, 6].map(multiKill), [null, 'Double kill', 'Triple kill', 'Quad kill', '6× multi-kill']);
  });

  it('says how long ago a death was, short', () => {
    assert.deepEqual([2_000, 12_400, 185_000, 2 * 3_600_000].map(shortAgo), ['now', '12s', '3m', '2h']);
  });

  it('labels what the game says about a death', () => {
    assert.equal(DEATH_TAGS.Penetration, 'Wallbang');
    assert.equal(DEATH_TAGS.Headshot, undefined);
  });

  it('shows the kill feed’s match, or says why there is none', () => {
    assert.equal(liveState(null, NOW), 'loading');
    assert.equal(liveState(snapshot({ match: { kills: 3 } }), NOW), 'match');
    assert.equal(liveState(snapshot(), NOW), 'waiting');
    assert.equal(liveState(snapshot({ feed: false }), NOW), 'scoreboard');
    assert.equal(liveState(snapshot({ server: { ...server, phase: 'empty' }, currentMatch: null }), NOW), 'empty');
    assert.equal(liveState(snapshot({ server: { ...server, seenAt: NOW - 10 * 60_000 } }), NOW), 'offline');
    assert.equal(liveState(snapshot({ server: null }), NOW), 'offline');
    assert.equal(liveState(snapshot({ server: null, match: { kills: 3 } }), NOW), 'match');
  });
});

describe('staff page', () => {
  // A session token as the bot signs it: base64url JSON, a dot, a base64url signature.
  const token = (payload) => `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJl`;

  it('reads the session or the problem the bot sent back after #', () => {
    const session = token({ userId: '42', name: 'Paragon', expiresAt: NOW });

    assert.deepEqual(signInResult(`#session=${session}`), { session });
    assert.deepEqual(signInResult('#error=not-staff'), { error: SIGN_IN_ERRORS['not-staff'] });
    assert.deepEqual(signInResult('#error=something-new'), { error: SIGN_IN_ERRORS.failed });
    assert.equal(signInResult('#session=<script>'), null);
    assert.equal(signInResult(''), null);
    assert.equal(signInResult('#weapons'), null);
  });

  it('reads when a session runs out, and null from anything else', () => {
    assert.equal(sessionExpiry(token({ userId: '42', name: 'Paragon', expiresAt: NOW })), NOW);
    assert.equal(sessionExpiry(token({ userId: '42' })), null);
    assert.equal(sessionExpiry('not a token'), null);
  });

  it('words the flags with the bot’s marks', () => {
    const marks = { teamKills: 3, sameTeammate: 2, vehicleSuicides: 2, suicides: 10 };

    assert.equal(flagLabel('sameTeammate'), 'Same teammate');
    assert.equal(flagRule('teamKills', marks), '3 or more team kills in a day');
    assert.equal(flagRule('vehicleSuicides', marks), '2 or more suicides in a vehicle in a day (crashing it, or blowing it up)');
    assert.equal(flagLabel('newFlag'), 'newFlag');
  });

  it('says who did what', () => {
    assert.equal(MOD_ACTIONS.ban, 'Ban');
    assert.equal(staffBy({ by: 'bot' }), 'The bot');
    assert.equal(staffBy({ by: 'server' }), 'Outside the bot');
    assert.equal(staffBy({ by: '42', byName: 'Paragon' }), 'Paragon');
    assert.equal(staffBy({ by: '42' }), 'Discord user 42');
  });

  it('names staff by who the bot knows them as, before the name kept with an entry', () => {
    const staff = { 42: { name: 'Sarge', username: 'paragon' }, 43: { name: 'kestrel', username: 'Kestrel' }, 44: { name: 'Moth', username: null } };

    assert.equal(staffBy({ by: '42', byName: 'Old name' }, staff), 'Sarge (@paragon)');
    assert.equal(staffBy({ by: '43' }, staff), 'kestrel');
    assert.equal(staffBy({ by: '44' }, staff), 'Moth');
    assert.equal(staffBy({ by: '45', byName: 'Pike' }, staff), 'Pike');
    assert.equal(staffBy({ by: 'bot' }, staff), 'The bot');
    assert.equal(staffLabel({ name: 'Sarge', username: 'paragon' }), 'Sarge (@paragon)');
  });

  it('adds how many were with a vehicle, when any were', () => {
    assert.equal(withVehicle(5, 2), '5 (2 vehicle)');
    assert.equal(withVehicle(5, 0), '5');
  });
});

describe('risky Steam accounts', () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const account = (overrides = {}) => ({
    vacBans: 0,
    gameBans: 0,
    lastBanAt: null,
    communityBanned: false,
    tradeBan: 'none',
    public: true,
    setUp: true,
    createdAt: NOW - 3000 * DAY,
    ...overrides,
  });

  it('words the flags with the bot’s marks', () => {
    const marks = { recentBanDays: 365, newAccountDays: 30, youngAccountDays: 180 };

    assert.equal(steamFlagLabel('vacBan'), 'VAC ban');
    assert.equal(steamFlagLabel('hidden'), 'Hidden profile');
    assert.equal(steamFlagRule('recentBan', marks), 'the latest VAC or game ban was in the last 365 days');
    assert.equal(steamFlagRule('newAccount', marks), 'made in the last 30 days');
    assert.equal(steamFlagLabel('newFlag'), 'newFlag');
    assert.equal(RISK_LABELS.medium, 'Worth a look');
  });

  it('says how long ago in days, months or years, as the bot does', () => {
    assert.equal(longAgo(NOW - HOUR, NOW), 'today');
    assert.equal(longAgo(NOW - DAY, NOW), '1 day ago');
    assert.equal(longAgo(NOW - 400 * DAY, NOW), '13 months ago');
    assert.equal(longAgo(NOW - 800 * DAY, NOW), '2 years ago');
  });

  it('says why an account is risky, and how old it is', () => {
    assert.deepEqual(steamWhy(account({ vacBans: 2, gameBans: 1, lastBanAt: NOW - 10 * DAY, public: false }), NOW), [
      '2 VAC bans and 1 game ban, the last 10 days ago',
      'Private profile',
    ]);
    assert.deepEqual(steamWhy(account({ vacBans: 1, lastBanAt: NOW - 45 * DAY, communityBanned: true, tradeBan: 'banned', setUp: false }), NOW), [
      '1 VAC ban, 45 days ago',
      'Banned from the Steam Community',
      'Banned from trading',
      'Profile never set up',
    ]);
    assert.deepEqual(steamWhy(account({ tradeBan: 'probation' }), NOW), []);
    assert.equal(accountAge(account({ createdAt: NOW - 3 * DAY }), NOW), 'Made 3 days ago');
    assert.equal(accountAge(account({ createdAt: null }), NOW), 'Hidden');
  });

  it('gives the share of kills that were headshots', () => {
    assert.equal(headshotShare(30, 21), '70% of 30 kills');
    assert.equal(headshotShare(0, 0), null);
  });
});

describe('admin tools', () => {
  const definitions = [
    { name: 'kick', description: 'Remove a player from the server; they can rejoin (staff only)', options: [{ type: 3, name: 'player', required: true }] },
    {
      name: 'vip',
      description: 'Give or take away a reserved slot (staff only)',
      options: [
        { type: 1, name: 'add', description: 'Give a player a reserved slot', options: [{ type: 3, name: 'steam_id' }, { type: 4, name: 'days' }] },
        { type: 1, name: 'remove', description: 'Take a player off the reserved list', options: [{ type: 3, name: 'steam_id' }] },
      ],
    },
    { name: 'newthing', description: 'Something new (staff only)', options: [] },
    { name: 'player', description: 'Look someone up', options: [] },
  ];

  it('makes a tool per command and per subcommand, in the page’s order, with anything new last', () => {
    const tools = toolsFrom(definitions);

    assert.deepEqual(
      tools.map((t) => [t.key, t.name, t.subcommand, t.label, t.group]),
      [
        ['player', 'player', null, 'Look up a player', 'Players'],
        ['kick', 'kick', null, 'Kick', 'Players'],
        ['vip:add', 'vip', 'add', 'Give VIP', 'VIP'],
        ['vip:remove', 'vip', 'remove', 'Remove VIP', 'VIP'],
        ['newthing', 'newthing', null, 'Something new', 'Other'],
      ],
    );
    assert.equal(tools[1].description, 'Remove a player from the server; they can rejoin');
    assert.deepEqual(tools[2].options.map((o) => o.name), ['steam_id', 'days']);
    assert.ok(READ_ONLY_TOOLS.has('player'));
    assert.ok(!READ_ONLY_TOOLS.has('kick'));
  });

  it('labels options', () => {
    assert.equal(optionLabel('steam_id'), 'Player');
    assert.equal(optionLabel('player'), 'Player');
    assert.equal(optionLabel('infantry_only'), 'Infantry only');
  });

  it('reads Discord’s markdown in a reply', () => {
    assert.deepEqual(discordParts('🔨 Banned **Ash\\_\\*** until <t:1791000000:f>. By <@42>, pinging <@&7>.'), [
      { type: 'text', text: '🔨 Banned ' },
      { type: 'strong', text: 'Ash_*' },
      { type: 'text', text: ' until ' },
      { type: 'time', at: 1791000000000 },
      { type: 'text', text: '. By ' },
      { type: 'user', id: '42' },
      { type: 'text', text: ', pinging ' },
      { type: 'role', id: '7' },
      { type: 'text', text: '.' },
    ]);
    assert.deepEqual(discordParts('`76561198000000001` · [Steam profile](https://steamcommunity.com/profiles/1)'), [
      { type: 'code', text: '76561198000000001' },
      { type: 'text', text: ' · ' },
      { type: 'link', text: 'Steam profile', href: 'https://steamcommunity.com/profiles/1' },
    ]);
    assert.deepEqual(discordParts('[bad](javascript:alert(1))'), [{ type: 'text', text: '[bad](javascript:alert(1))' }]);
  });
});

describe('mapSegments', () => {
  const teams = [{ name: 'Valkyra' }, { name: 'Kharr' }, { name: 'Haldor' }];

  it('keeps the overall order of the teams on every map, then the draws', () => {
    const map = { map: 'Ozeti', matches: 10, draws: 2, teams: [{ name: 'KHARR', wins: 5 }, { name: 'Valkyra', wins: 3 }, { name: 'Haldor', wins: 0 }] };

    assert.deepEqual(mapSegments(map, teams), [
      { name: 'Valkyra', count: 3, share: 0.3 },
      { name: 'Kharr', count: 5, share: 0.5 },
      { name: null, count: 2, share: 0.2 },
    ]);
  });

  it('leaves out teams with no wins there, and draws when there were none', () => {
    const map = { map: 'Bakurani', matches: 1, draws: 0, teams: [{ name: 'Haldor', wins: 1 }] };

    assert.deepEqual(mapSegments(map, teams), [{ name: 'Haldor', count: 1, share: 1 }]);
  });
});
