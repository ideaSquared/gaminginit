import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  announcement,
  countdown,
  countdownText,
  dayRange,
  manyHours,
  ROLE_AWARDS,
  SEASON_BOARDS,
  shoutOuts,
  busyRuns,
  busyShares,
  clockHour,
  compact,
  emptyNote,
  formatDuration,
  formatHours,
  hourlyAverages,
  isOnline,
  kd,
  kdNeeds,
  latestMatches,
  mapSegments,
  mapKey,
  monthStarts,
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
  timeRange,
  toLocalHours,
  vipDetail,
  vipOffer,
  BOARDS,
  boardRows,
  bests,
  byMap,
  bySide,
  calendarWeeks,
  contrast,
  readableColour,
  sideColours,
  factionColours,
  feedEmpty,
  feedKillShown,
  BUTTON_BACKGROUND,
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
  modActionCounts,
  modActionLabel,
  readSteamId,
  sessionExpiry,
  staffNote,
  steamLinkedText,
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
  headshotCount,
  headshotRule,
  headshotShare,
  flaggedDaysLabel,
  killerSummary,
  luckOdds,
  oddsKind,
  ordinaryHeadshots,
  usualHeadshots,
  watchList,
  needsLook,
  byLook,
  teamCounts,
  filterPlayers,
  lookFirst,
  lookReasons,
  checkHolds,
  lookNow,
  checkOf,
  recentActions,
  actedText,
  checkedText,
  presetReasons,
  PRESET_REASONS,
  teamOptions,
  alertCount,
  discordParts,
  defaultLabel,
  optionLabel,
  READ_ONLY_TOOLS,
  asksFirst,
  actionLabel,
  reasonFor,
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

  it('writes the hour without a leading zero on a 12-hour clock, and with one on a 24-hour clock', () => {
    const at = (hour) => new Date(2026, 0, 1, hour, 5);
    const clock = (locale, hour) => new Intl.DateTimeFormat(locale, { hour: clockHour(locale), minute: '2-digit' }).format(at(hour));
    assert.equal(clock('en-US', 19), '7:05 PM');
    assert.equal(clock('en-US', 7), '7:05 AM');
    assert.equal(clock('en-GB', 19), '19:05');
    assert.equal(clock('en-GB', 7), '07:05');
    assert.equal(clock('de-DE', 7), '07:05');
  });

  it('formats counts and ratios', () => {
    assert.equal(compact(1284), '1,284');
    assert.equal(compact(12_900), '12.9K');
    assert.equal(compact(2_400_000), '2.4M');
    assert.equal(kd(9, 3), '3.00');
    assert.equal(kd(4, 0), '4.00');
  });

  it('names the winner, or no result when the top two are level', () => {
    const scores = [
      { name: 'Kharr', score: 255 },
      { name: 'Valkyra', score: 300 },
    ];
    assert.deepEqual(result(scores), { winner: 'Valkyra', text: 'Valkyra won 300–255' });
    assert.equal(result([{ name: 'A', score: 5 }, { name: 'B', score: 5 }]).text, 'No result: 5–5');
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
      text: 'No result: A 9, B 9, C 2',
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

  it('puts the month on the first day label and wherever the month changes', () => {
    const day = (iso) => Date.parse(`${iso}T00:00:00Z`);
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map(day);
    assert.deepEqual(monthStarts(days, [true, true, true, true, true]), [true, false, true, false, false]);
    // Every other day: the month changes at the first label shown in October, even when 1 Oct itself has none.
    assert.deepEqual(monthStarts(days, [false, true, false, true, false]), [false, true, false, true, false]);
    assert.deepEqual(monthStarts([], []), []);
  });
});

// Times in the reader's locale; ICU puts a narrow no-break space before AM and PM, so spaces are made plain here.
const plain = (text) => text.replace(/\s/g, ' ');
const clockIn = (locale) => new Intl.DateTimeFormat(locale, { hour: clockHour(locale), minute: '2-digit' });
const at = (hour) => new Date(2000, 0, 1, hour);

describe('times of day', () => {
  it('drops the leading zero on a 12-hour clock and keeps it on a 24-hour one', () => {
    assert.equal(clockHour('en-US'), 'numeric');
    assert.equal(clockHour('en-GB'), '2-digit');
    assert.equal(plain(clockIn('en-US').format(at(19))), '7:00 PM');
    assert.equal(plain(clockIn('en-US').format(at(5))), '5:00 AM');
    assert.equal(plain(clockIn('en-US').format(at(0))), '12:00 AM');
    assert.equal(clockIn('en-GB').format(at(19)), '19:00');
    assert.equal(clockIn('en-GB').format(at(5)), '05:00');
    assert.equal(clockIn('en-GB').format(at(0)), '00:00');
  });

  it('says AM or PM once for a range that has the same one at both ends', () => {
    assert.equal(plain(timeRange(clockIn('en-US'), at(19), at(22))).replace(/ – /, '–'), '7:00–10:00 PM');
    assert.equal(plain(timeRange(clockIn('en-US'), at(11), at(14))).replace(/ – /, '–'), '11:00 AM–2:00 PM');
    assert.equal(plain(timeRange(clockIn('en-US'), at(23), at(0))).replace(/ – /, '–'), '11:00 PM–12:00 AM');
    assert.equal(timeRange(clockIn('en-GB'), at(19), at(22)).replace(/ – /, '–'), '19:00–22:00');
    assert.equal(timeRange(clockIn('en-GB'), at(23), at(0)).replace(/ – /, '–'), '23:00–00:00');
  });

  it('writes both ends out in full where the browser cannot make a range', () => {
    const plainFormat = { format: (date) => `${date.getHours()}h` };
    assert.equal(timeRange(plainFormat, at(19), at(22)), '19h–22h');
  });
});

const vip = { seedDays: 3, seedMinutes: 10, windowDays: 7, lengthDays: 7 };

describe('seeder VIP', () => {
  it('says what seeding earns, from the bot’s rule', () => {
    assert.equal(vipOffer(vip), 'Seed on 3 days in a week and get a whitelist slot for a week.');
    assert.equal(vipOffer({ ...vip, seedDays: 1, windowDays: 14 }), 'Seed on 1 day in 14 days and get a whitelist slot for a week.');
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
    assert.equal(BOARDS.find((b) => b.key === 'kd').sub({ kdMinMatches: 10 }), 'At least 10 matches.');
  });

  it('says what the K/D board needs, including from a bot that still counts time played', () => {
    assert.equal(kdNeeds({ kdMinMatches: 10 }, '+'), '10+ matches');
    assert.equal(kdNeeds({ kdMinHours: 10 }), '10 hours played');
    // A bot sending both, while it moves from one to the other, means matches.
    assert.equal(kdNeeds({ kdMinMatches: 10, kdMinHours: 5 }), '10 matches');
    assert.equal(kdNeeds({ kdMinMatches: 1 }), '1 match');
    assert.equal(kdNeeds({ kdMinHours: 1 }), '1 hour played');
    assert.equal(kdNeeds({ kdMinMatches: 1 }, '+'), '1+ matches');
    assert.equal(BOARDS.find((b) => b.key === 'kd').sub({ kdMinHours: 10 }), 'At least 10 hours played.');
  });

  it('leaves players with no seed days off the top seeders, and keeps the rest in the bot’s order', () => {
    const seeders = BOARDS.find((b) => b.key === 'seeding');
    const leaderboard = {
      seeding: [
        { name: 'Sable', seedDays: 11, seedingMinutes: 520 },
        { name: 'Moth', seedDays: 6, seedingMinutes: 260 },
        { name: 'Ash', seedDays: 0, seedingMinutes: 12 },
      ],
    };
    assert.deepEqual(boardRows(seeders, leaderboard).map((p) => p.name), ['Sable', 'Moth']);
    assert.equal(boardRows(seeders, { seeding: [leaderboard.seeding[2]] }).length, 0);
  });

  it('leaves the other boards’ rows alone, and gives none when the bot sent none', () => {
    const kills = BOARDS.find((b) => b.key === 'kills');
    const rows = [{ name: 'Ash', kills: 0, deaths: 0 }];
    assert.deepEqual(boardRows(kills, { kills: rows }), rows);
    assert.deepEqual(boardRows(kills, {}), []);
    assert.deepEqual(boardRows(kills, undefined), []);
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
    const list = [match(1), match(2, { result: 'lost' }), match(3, { result: null }), match(4, { result: 'lost' }), match(5)];

    assert.deepEqual(results(list), { won: 2, lost: 2, decided: 4, share: 0.5 });
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

    assert.equal(seedProgress({ rule, seedDays: 1 }), '1 of 3 seed days in the last 7 days. 2 more earns a whitelist slot.');
    assert.equal(seedProgress({ rule, seedDays: 3 }), '3 seed days in the last 7 days. That earns a whitelist slot.');
    assert.equal(
      seedProgress({ rule, seedDays: 0 }, true),
      'No seed days in the last 7 days yet. Seeding on 3 days in a week keeps the whitelist slot for another week.',
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

  it('lightens a side’s colour enough that the page’s dark ink reads on it, as on the Teams bars', () => {
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const ink = rgb('#0b0d10');
    const steps = [0, 51, 102, 153, 204, 255];
    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          assert.ok(contrast(rgb(readableColour(hex)), ink) >= 4.5, hex);
        }
      }
    }
  });

  it('has each faction’s colour, readable on a button', () => {
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const button = rgb(BUTTON_BACKGROUND);
    assert.deepEqual([...factionColours.keys()], ['lonestar', 'manticore', 'valkyra']);
    for (const [name, colour] of factionColours) assert.ok(contrast(rgb(colour), button) >= 4.5, name);
  });

  it('takes each side’s colour from its latest match, however the server spelled it', () => {
    const colours = sideColours([
      match(2, { factionScores: [{ name: 'LONESTAR', score: 100, colorHex: '#ff3333' }, { name: 'Valkyra', score: 50 }] }),
      match(1, { factionScores: [{ name: 'Lone Star', score: 100, colorHex: '#ffaa00' }] }),
    ]);

    assert.equal(colours.get('lonestar'), '#ff3333');
    assert.equal(colours.has('valkyra'), false);
  });

  it('makes each side’s colour readable on a button when asked', () => {
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const colours = sideColours([match(1, { factionScores: [{ name: 'Valkyra', score: 1, colorHex: '#3366ff' }] })], BUTTON_BACKGROUND);

    assert.ok(contrast(rgb(colours.get('valkyra')), rgb(BUTTON_BACKGROUND)) >= 4.5);
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
    { day: '2026-09-01', name: 'AK74', kind: 'weapon', lockOn: false, kills: 30, headshots: 9, longest: 900 },
    { day: '2026-09-20', name: 'AK74', kind: 'weapon', lockOn: false, kills: 4, headshots: 1, longest: 61.2 },
    { day: '2026-09-20', name: 'Humvee', kind: 'vehicle', lockOn: false, kills: 5, headshots: 0, longest: null },
    { day: '2026-09-29', name: 'AK74', kind: 'weapon', lockOn: false, kills: 2, headshots: 2, longest: 140.5 },
    { day: '2026-09-29', name: 'SVD', kind: 'weapon', lockOn: false, kills: 6, headshots: 3, longest: null },
  ];

  it('writes distances in metres, to a tenth under 10 m', () => {
    assert.equal(metres(4.53), '4.5 m');
    assert.equal(metres(4), '4 m');
    assert.equal(metres(612.3), '612 m');
    assert.equal(metres(1204.6), '1,205 m');
  });

  it('adds up a player’s weapons over the days from the first one asked for, most kills first', () => {
    assert.deepEqual(weaponTotals(used, '2026-09-10'), [
      { name: 'AK74', kind: 'weapon', lockOn: false, kills: 6, headshots: 3, longest: 140.5 },
      { name: 'SVD', kind: 'weapon', lockOn: false, kills: 6, headshots: 3, longest: null },
      { name: 'Humvee', kind: 'vehicle', lockOn: false, kills: 5, headshots: 0, longest: null },
    ]);
    assert.equal(weaponTotals(used, '2026-08-01')[0].kills, 36);
    assert.deepEqual(weaponTotals(undefined, '2026-09-10'), []);
  });

  it('finds their longest kill, and what with', () => {
    assert.deepEqual(longestKill(weaponTotals(used, '2026-09-10')), { distance: 140.5, weapon: 'AK74' });
    assert.equal(longestKill(weaponTotals(used.slice(2, 3), '2026-09-10')), null);
  });

  it('takes their longest kill from hand-held weapons that do not lock on', () => {
    const others = [
      { day: '2026-09-29', name: 'AT mine', kind: 'placed', lockOn: false, kills: 1, headshots: 0, longest: 851.1 },
      { day: '2026-09-29', name: 'STN 03 Main barrel', kind: 'vehicle-weapon', lockOn: false, kills: 3, headshots: 0, longest: 706.8 },
      { day: '2026-09-29', name: 'Barbed wire', kind: 'buildable', lockOn: false, kills: 1, headshots: 0, longest: 2.1 },
      // Carried by hand, but it locks on.
      { day: '2026-09-29', name: '9K333 Verba', kind: 'weapon', lockOn: true, kills: 2, headshots: 0, longest: 1450.2 },
    ];
    assert.deepEqual(longestKill(weaponTotals([...used, ...others], '2026-09-10')), { distance: 140.5, weapon: 'AK74' });
    assert.equal(longestKill(weaponTotals(others, '2026-09-10')), null);
  });

  it('labels the weapons that are not carried by hand', () => {
    assert.equal(WEAPON_KINDS.weapon, undefined);
    assert.equal(WEAPON_KINDS['vehicle-weapon'], 'Vehicle gun');
    assert.equal(WEAPON_KINDS.placed, 'Placed');
    assert.equal(WEAPON_KINDS.emplacement, 'Emplacement');
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

  it('reads a Steam64 ID to link, or the profile link it is in, as the bot does', () => {
    const id = '76561198000000001';

    assert.equal(readSteamId(` ${id} `), id);
    assert.equal(readSteamId(`https://steamcommunity.com/profiles/${id}/`), id);
    assert.equal(readSteamId(`steamcommunity.com/profiles/${id}?l=english`), id);
    assert.equal(readSteamId('https://steamcommunity.com/id/sarge'), null);
    assert.equal(readSteamId('STEAM_0:1:19999'), null);
    assert.equal(readSteamId('7656119800000000'), null);
    assert.equal(readSteamId(`https://example.com/profiles/${id}`), null);
    assert.equal(readSteamId(undefined), null);
  });

  it('says how many on the whitelist have staff spots', () => {
    assert.equal(staffNote(0, 4), '');
    assert.equal(staffNote(1, 4), '1 of them is staff.');
    assert.equal(staffNote(2, 4), '2 of them are staff.');
    assert.equal(staffNote(3, 3), 'All of them are staff.');
    assert.equal(staffNote(1, 1), 'They are staff.');
  });

  it('says whose Steam account was linked, and warns when the bot has not seen it in game', () => {
    const id = '76561198000000001';

    assert.match(steamLinkedText({ steamId: id, player: 'Sarge' }), /^Linked to Sarge \(76561198000000001\)\. From now on/);
    assert.match(steamLinkedText({ steamId: id, player: null }), /hasn’t seen this account on our server in the last 90 days/);
    assert.match(steamLinkedText({ steamId: id, player: null, sample: true }), /^Sample only/);
  });

  it('words the flags with the bot’s marks', () => {
    const marks = { teamKills: 3, sameTeammate: 2, vehicleSuicides: 2, suicides: 10 };

    assert.equal(flagLabel('sameTeammate'), 'Same teammate');
    assert.equal(flagRule('teamKills', marks), '3 or more team kills in a day');
    assert.equal(flagRule('sameTeammate', marks), 'killed the same teammate 2 or more times in a day');
    // From a bot that leaves helicopter crashes out of them.
    assert.equal(flagRule('teamKills', marks, true), '3 or more team kills in a day, not counting helicopter crashes');
    assert.equal(flagRule('sameTeammate', marks, true), 'killed the same teammate 2 or more times in a day, not counting helicopter crashes');
    assert.equal(flagRule('vehicleSuicides', marks, true), '2 or more suicides in a vehicle in a day (crashing it, or blowing it up)');
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

  it('counts the moderation log by kind of action, for its filter', () => {
    const log = [{ action: 'switchteam' }, { action: 'ban' }, { action: 'switchteam' }, { action: 'newAction' }];

    assert.deepEqual(modActionCounts(log), [
      { action: 'warn', count: 0 },
      { action: 'kick', count: 0 },
      { action: 'ban', count: 1 },
      { action: 'unban', count: 0 },
      { action: 'switchteam', count: 2 },
      { action: 'vip-add', count: 0 },
      { action: 'vip-remove', count: 0 },
      { action: 'newAction', count: 1 },
    ]);
    assert.equal(modActionCounts([]).length, Object.keys(MOD_ACTIONS).length);
  });

  it('names an action, or shows it as sent when the page has no name for it', () => {
    assert.equal(modActionLabel('switchteam'), 'Team move');
    assert.equal(modActionLabel('vip-add'), 'VIP added');
    assert.equal(modActionLabel('vip-remove'), 'VIP removed');
    assert.equal(modActionLabel('newAction'), 'newAction');
    assert.equal(modActionLabel('toString'), 'toString');
    assert.equal(modActionLabel('constructor'), 'constructor');
  });

  it('adds how many were with a vehicle, and in a helicopter crash, when any were', () => {
    assert.equal(withVehicle(5, 2), '5 (2 vehicle)');
    assert.equal(withVehicle(5, 0), '5');
    assert.equal(withVehicle(5, 3, 2), '5 (3 vehicle, 2 crash)');
    assert.equal(withVehicle(5, 0, 0), '5');
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
      description: 'Give or take away a whitelist slot (staff only)',
      options: [
        { type: 1, name: 'add', description: 'Give a player a whitelist slot', options: [{ type: 3, name: 'steam_id' }, { type: 4, name: 'days' }] },
        { type: 1, name: 'remove', description: 'Take a player off the whitelist', options: [{ type: 3, name: 'steam_id' }] },
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
    assert.ok(READ_ONLY_TOOLS.has('rotations:show'));
    assert.ok(READ_ONLY_TOOLS.has('private:list'));
    assert.ok(!READ_ONLY_TOOLS.has('private:add'));
    assert.ok(!READ_ONLY_TOOLS.has('kick'));
    assert.ok(!READ_ONLY_TOOLS.has('rotations:use'));
  });

  it('names what a tool does to a player', () => {
    assert.equal(actionLabel('warn', 'Vex'), 'Warn Vex');
    assert.equal(actionLabel('ban', 'Vex'), 'Ban Vex');
    assert.equal(actionLabel('ban', 'Vex', '3 days'), 'Ban Vex for 3 days');
    assert.equal(actionLabel('ban', 'Vex', 'Permanent'), 'Ban Vex for good');
    assert.equal(actionLabel('switchteam', 'Vex', null), 'Move Vex to another team');
    assert.equal(actionLabel('switchteam', 'Vex', 'Manticore'), 'Move Vex to Manticore');
    assert.equal(actionLabel('private:add', 'Vex'), 'Make Vex’s profile private');
    assert.equal(actionLabel('vip:add', 'Vex', 'Friend'), 'Give Vex VIP');
    // No name yet, or a tool with no such words: the tool keeps its own label.
    assert.equal(actionLabel('ban', null, '3 days'), null);
    assert.equal(actionLabel('broadcast', 'Vex'), null);
    assert.equal(actionLabel('toString', 'Vex'), null);
  });

  it('starts a reason from what a player did today, never from headshots', () => {
    const player = { teamKillsToday: 0, vehicleSuicidesToday: 0, headshotsToday: { flagged: true } };
    assert.equal(reasonFor(player), null);
    assert.equal(reasonFor({ ...player, vehicleSuicidesToday: 2 }), 'Team vehicles');
    assert.equal(reasonFor({ ...player, teamKillsToday: 1, vehicleSuicidesToday: 2 }), 'Team killing');
    assert.equal(reasonFor(null), null);
    // Each is a preset staff can pick.
    for (const label of ['Team killing', 'Team vehicles']) assert.ok(PRESET_REASONS.some((r) => r.label === label));
  });

  it('asks first for anything that changes the game, but a warning', () => {
    assert.equal(asksFirst('player'), false);
    assert.equal(asksFirst('rotations:show'), false);
    assert.equal(asksFirst('warn'), false);
    assert.equal(asksFirst('kick'), true);
    assert.equal(asksFirst('ban'), true);
    assert.equal(asksFirst('switchteam'), true);
    assert.equal(asksFirst('broadcast'), true);
  });

  it('labels options', () => {
    assert.equal(optionLabel('steam_id'), 'Player');
    assert.equal(optionLabel('player'), 'Player');
    assert.equal(optionLabel('infantry_only'), 'Infantry only');
  });

  it('says what leaving an option out means, from its description', () => {
    assert.equal(defaultLabel('Infantry only (default: as in the rotation)'), 'As in the rotation');
    assert.equal(defaultLabel('Hardcore (default: off)'), 'Off (default)');
    assert.equal(defaultLabel('Hardcore'), 'Default');
    assert.equal(defaultLabel(undefined), 'Default');
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

  it('keeps the overall order of the teams on every map', () => {
    const map = { map: 'Ozeti', matches: 10, teams: [{ name: 'KHARR', wins: 5 }, { name: 'Valkyra', wins: 3 }, { name: 'Haldor', wins: 2 }] };

    assert.deepEqual(mapSegments(map, teams), [
      { name: 'Valkyra', count: 3, share: 0.3 },
      { name: 'Kharr', count: 5, share: 0.5 },
      { name: 'Haldor', count: 2, share: 0.2 },
    ]);
  });

  it('leaves out teams with no wins there', () => {
    const map = { map: 'Bakurani', matches: 1, teams: [{ name: 'Haldor', wins: 1 }] };

    assert.deepEqual(mapSegments(map, teams), [{ name: 'Haldor', count: 1, share: 1 }]);
  });
});

describe('the staff page server list', () => {
  const TODAY = '2026-10-03';
  const player = (name, overrides = {}) => ({
    steamId: `7656119800000${name.length}${name.charCodeAt(0)}`,
    name,
    faction: 'Valkyra',
    kills: 0,
    deaths: 0,
    minutesToday: 30,
    firstSeen: '2026-08-01',
    steam: null,
    griefFlags: [],
    teamKillsToday: 0,
    vehicleSuicidesToday: 0,
    banned: false,
    reserved: false,
    ...overrides,
  });
  const ash = player('Ash', { kills: 12, deaths: 3, minutesToday: 90, steam: { risk: 'high', score: 5, flags: ['vacBan', 'hidden'] } });
  const bo = player('Bo', { faction: 'Manticore', kills: 4, firstSeen: TODAY });
  const cy = player('Cy', { faction: null, kills: null, deaths: null, teamKillsToday: 3, griefFlags: ['teamKills'] });
  const dee = player('Dee', { kills: 4, deaths: 1, reserved: true, teamKillsToday: 1, steam: { risk: 'low', score: 1, flags: ['hidden'] } });
  const all = [dee, cy, bo, ash];

  it('shows what is worth watching about a player', () => {
    assert.deepEqual(watchList(ash, TODAY), [{ text: 'High-risk Steam account', kind: 'bad', title: 'VAC ban, Hidden profile' }]);
    assert.deepEqual(watchList(cy, TODAY), [{ text: '3 team kills today', kind: 'bad' }]);
    assert.deepEqual(watchList(dee, TODAY), [{ text: '1 team kill today', kind: '' }, { text: 'VIP', kind: '' }]);
    // Being new is worth knowing, but no reason to look on its own.
    assert.deepEqual(watchList(bo, TODAY), [{ text: 'New today', kind: '', title: 'First time on the server in 90 days' }]);
    assert.deepEqual(watchList(player('Eve', { banned: true, vehicleSuicidesToday: 2, griefFlags: ['vehicleSuicides'] }), TODAY), [
      { text: 'Banned', kind: 'bad' },
      { text: '2 vehicle suicides today', kind: 'hot' },
    ]);
  });

  it('knows who is worth a look, and being new is not a reason on its own', () => {
    assert.deepEqual(all.filter((p) => needsLook(p)).map((p) => p.name), ['Cy', 'Ash']);
  });

  it('puts the banned first, then griefers with the most team kills, then headshots, then risky Steam accounts', () => {
    const high = { risk: 'high', score: 6, flags: ['vacBan', 'gameBan'] };
    const list = [
      player('New', { firstSeen: TODAY }),
      player('Risky', { steam: { risk: 'medium', score: 3, flags: ['vacBan'] } }),
      player('Aim', { headshotsToday: { kills: 20, headshots: 15, expected: 5, chance: 1e-7, flagged: true } }),
      player('Few', { teamKillsToday: 2 }),
      // Team kills in a helicopter crash, which flag nothing, however many.
      player('Pilot', { teamKillsToday: 30 }),
      player('Some', { teamKillsToday: 4, griefFlags: ['teamKills'], steam: high }),
      player('Lots', { teamKillsToday: 9, griefFlags: ['teamKills', 'sameTeammate'] }),
      player('High', { steam: high }),
      player('Gone', { banned: true }),
    ];

    assert.deepEqual(
      filterPlayers(list, {}).map((p) => p.name),
      ['Gone', 'Lots', 'Some', 'Aim', 'High', 'Risky', 'Pilot', 'Few', 'New'],
    );
    // Being new puts nobody ahead of anyone.
    assert.equal(byLook(player('Nobody', { firstSeen: TODAY }), player('Plain')), 0);
  });

  it('shows today’s headshots when they are unlikely by luck, and red once the day is flagged', () => {
    const today = (overrides) => ({ kills: 20, headshots: 15, expected: 5.3, chance: 1e-7, flagged: true, ...overrides });
    const flagged = player('Fay', { headshotsToday: today() });
    assert.deepEqual(watchList(flagged, TODAY), [
      { text: '15 of 20 kills headshots today', kind: 'bad', title: 'Usual: about 5. Chance by luck: 1 in 10 million.' },
    ]);
    assert.equal(needsLook(flagged), true);
    const lucky = player('Gil', { headshotsToday: today({ headshots: 9, chance: 0.02, flagged: false }) });
    assert.deepEqual(watchList(lucky, TODAY).map((b) => [b.text, b.kind]), [['9 of 20 kills headshots today', 'hot']]);
    assert.equal(needsLook(lucky), false);
    assert.deepEqual(watchList(player('Hal', { headshotsToday: today({ chance: 0.4, flagged: false }) }), TODAY), []);
    assert.deepEqual(watchList(player('Ivy', { headshotsToday: today({ expected: null, chance: null, flagged: false }) }), TODAY), []);
  });

  it('counts each team, biggest first, with no team last', () => {
    assert.deepEqual(teamCounts(all), [
      { name: 'Valkyra', count: 2 },
      { name: 'Manticore', count: 1 },
      { name: null, count: 1 },
    ]);
  });

  it('searches, filters and sorts the list', () => {
    const names = (options) => filterPlayers(all, options).map((p) => p.name);

    // The most worth a look first: Cy's flagged team kills, Ash's high-risk Steam account, Dee's one team kill, then
    // new Bo with nothing to look at.
    assert.deepEqual(names({}), ['Cy', 'Ash', 'Dee', 'Bo']);
    assert.deepEqual(names({ sort: 'watch' }), ['Cy', 'Ash', 'Dee', 'Bo']);
    assert.deepEqual(names({ sort: 'team' }), ['Bo', 'Ash', 'Dee', 'Cy']);
    assert.deepEqual(names({ query: ' a' }), ['Ash']);
    assert.deepEqual(names({ query: ash.steamId.slice(-4) }), ['Ash']);
    assert.deepEqual(names({ team: 'valkyra' }), ['Ash', 'Dee']);
    assert.deepEqual(names({ team: 'none' }), ['Cy']);
    assert.deepEqual(names({ watch: true, sort: 'name' }), ['Ash', 'Cy']);
    assert.deepEqual(names({ watch: true }), ['Cy', 'Ash']);
    // The team and search still apply, with those worth a look first.
    assert.deepEqual(names({ team: 'valkyra', sort: 'watch' }), ['Ash', 'Dee']);
    assert.deepEqual(names({ query: '7656119800000' }), ['Cy', 'Ash', 'Dee', 'Bo']);
    // Most kills, then fewest deaths; Cy has no kills reported.
    assert.deepEqual(names({ sort: 'kills' }), ['Ash', 'Bo', 'Dee', 'Cy']);
    assert.deepEqual(names({ sort: 'today' }), ['Ash', 'Bo', 'Cy', 'Dee']);
  });

  it('splits the list into those worth a look and everyone else, keeping the order picked', () => {
    const parts = (options) => {
      const { look, rest } = lookFirst(filterPlayers(all, options));
      return [look.map((p) => p.name), rest.map((p) => p.name)];
    };

    assert.deepEqual(parts({}), [['Cy', 'Ash'], ['Dee', 'Bo']]);
    // Whatever the order, those worth a look are the first part.
    assert.deepEqual(parts({ sort: 'kills' }), [['Ash', 'Cy'], ['Bo', 'Dee']]);
    assert.deepEqual(parts({ sort: 'name' }), [['Ash', 'Cy'], ['Bo', 'Dee']]);
    assert.deepEqual(parts({ team: 'manticore' }), [[], ['Bo']]);
    assert.deepEqual(lookFirst([]), { look: [], rest: [] });
  });

  it('says why a player is worth a look, and keeps a check until more comes up', () => {
    const vex = player('Vex', { teamKillsToday: 4, griefFlags: ['teamKills'], steam: { risk: 'medium', score: 3, flags: ['gameBan'] } });
    const check = { by: '100000000000000001', byName: 'Sarge', at: NOW - 60_000, reasons: ['griefing', 'steam'], teamKills: 4, vehicleSuicides: 0 };

    assert.deepEqual(lookReasons(vex), ['griefing', 'steam']);
    assert.deepEqual(lookReasons(player('Gone', { banned: true, headshotsToday: { flagged: true } })), ['banned', 'headshots']);
    assert.deepEqual(checkOf(vex), { reasons: ['griefing', 'steam'], teamKills: 4, vehicleSuicides: 0 });
    assert.equal(lookNow(vex), true);
    // Checked: no longer worth a look now, but still flagged.
    assert.equal(checkHolds({ ...vex, checked: check }), true);
    assert.equal(lookNow({ ...vex, checked: check }), false);
    assert.equal(needsLook({ ...vex, checked: check }), true);
    // Another team kill, a vehicle suicide or a new reason since: worth a look again.
    assert.equal(lookNow({ ...vex, teamKillsToday: 5, checked: check }), true);
    assert.equal(lookNow({ ...vex, vehicleSuicidesToday: 1, checked: check }), true);
    assert.equal(lookNow({ ...vex, banned: true, checked: check }), true);
    // Nothing checked (or an older bot, which sends no checks).
    assert.equal(checkHolds({ ...vex, checked: null }), false);
    assert.equal(checkHolds(vex), false);
  });

  it('leaves checked players out of the first part, and out of "Only players worth a look"', () => {
    const check = { by: '1', byName: 'Sarge', at: NOW, reasons: ['steam'], teamKills: 0, vehicleSuicides: 0 };
    const list = [{ ...ash, checked: check }, cy, dee, bo];

    const { look, rest } = lookFirst(filterPlayers(list, {}));
    assert.deepEqual(look.map((p) => p.name), ['Cy']);
    assert.deepEqual(rest.map((p) => p.name), ['Ash', 'Dee', 'Bo']);
    assert.deepEqual(filterPlayers(list, { watch: true }).map((p) => p.name), ['Cy']);
  });

  it('says what staff last did to each player in the last day', () => {
    const SARGE = '100000000000000001';
    const entry = (minutes, action, steamId, by = SARGE, extra = {}) => ({ at: NOW - minutes * 60_000, action, player: { steamId, name: steamId }, by, ...extra });
    const log = [entry(4, 'warn', 'vex'), entry(13, 'kick', 'vex'), entry(30, 'vip-add', 'moth'), entry(2, 'warn', 'pike', 'bot'), entry(26 * 60, 'ban', 'gone')];
    const recent = recentActions(log, NOW);
    const staff = { [SARGE]: { name: 'Sarge', username: 'sarge_gi' } };

    assert.deepEqual([...recent.keys()], ['vex', 'pike']);
    assert.equal(recent.get('vex').count, 2);
    assert.equal(actedText(recent.get('vex'), NOW, staff), 'Warned 4 min ago by Sarge (@sarge_gi) · 2 actions in 24 h');
    assert.equal(actedText(recent.get('pike'), NOW, staff), 'Warned 2 min ago by the bot');
    // The latest, whatever order the log is in.
    assert.equal(recentActions([...log].reverse(), NOW).get('vex').entry.action, 'warn');
    assert.equal(
      checkedText({ by: SARGE, byName: 'Sarge', at: NOW - 5 * 60_000 }, NOW, {}),
      'Checked by Sarge 5 min ago',
    );
  });

  it('offers reasons for warnings, kicks and bans only', () => {
    const warn = presetReasons('warn', 'message');
    assert.equal(warn[0].text, 'Stop team killing, or you will be kicked.');
    assert.ok(warn.every((r) => r.text.length <= 140));
    assert.ok(!warn.some((r) => r.label === 'Cheating'));
    assert.equal(presetReasons('kick', 'reason').length, PRESET_REASONS.length);
    assert.deepEqual(presetReasons('ban', 'reason').at(-1), { label: 'Ignoring warnings', text: 'Ignoring staff warnings' });
    assert.deepEqual(presetReasons('broadcast', 'message'), []);
    assert.deepEqual(presetReasons('kick', 'player'), []);
  });

  it("won't let staff move a player to the team they are on", () => {
    const choices = [
      { name: '🔵 Lonestar', value: 'Lonestar' },
      { name: '🟢 Manticore', value: 'Manticore' },
      { name: '🔴 Valkyra', value: 'Valkyra' },
    ];
    assert.deepEqual(teamOptions(choices, 'VALKYRA'), [
      { value: 'Lonestar', name: '🔵 Lonestar', disabled: false },
      { value: 'Manticore', name: '🟢 Manticore', disabled: false },
      { value: 'Valkyra', name: '🔴 Valkyra (their team now)', disabled: true },
    ]);
    // Not in game, or the server didn't say their team: every team can be picked, and the bot checks.
    assert.ok(teamOptions(choices, null).every((o) => !o.disabled));
  });

  it("filters the live kill feed to headshots, team kills or both, and says when that leaves none", () => {
    const feed = [
      { id: 'a', headshot: true, teamKill: false },
      { id: 'b', headshot: false, teamKill: true },
      { id: 'c', headshot: true, teamKill: true },
      { id: 'd', headshot: false, teamKill: false },
    ];
    const ids = (filters) => feed.filter((k) => feedKillShown(k, filters)).map((k) => k.id);

    assert.deepEqual(ids({}), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids({ headshots: true }), ['a', 'c']);
    assert.deepEqual(ids({ teamKills: true }), ['b', 'c']);
    assert.deepEqual(ids({ headshots: true, teamKills: true }), ['c']);

    assert.equal(feedEmpty(0, { teamKills: true }), 'No kills yet.');
    assert.equal(feedEmpty(5, { headshots: true }), 'No headshots among them.');
    assert.equal(feedEmpty(5, { teamKills: true }), 'No team kills among them.');
    assert.equal(feedEmpty(5, { headshots: true, teamKills: true }), 'No team kills by headshot among them.');

    // Only one player's kills and deaths.
    const theirs = [
      { id: 'e', killer: { steamId: 'vex' }, victim: { steamId: 'ash' }, headshot: true, teamKill: false },
      { id: 'f', killer: { steamId: 'ash' }, victim: { steamId: 'vex' }, headshot: false, teamKill: true },
      { id: 'g', killer: { steamId: 'ash' }, victim: { steamId: 'bo' }, headshot: false, teamKill: false },
    ];
    const of = (filters) => theirs.filter((k) => feedKillShown(k, filters)).map((k) => k.id);
    assert.deepEqual(of({ player: 'vex' }), ['e', 'f']);
    assert.deepEqual(of({ player: 'vex', teamKills: true }), ['f']);
    assert.equal(feedEmpty(5, { player: 'vex', playerName: 'Vex' }), 'No kills or deaths with Vex among them.');
    assert.equal(feedEmpty(5, { player: 'vex', playerName: 'Vex', headshots: true }), 'No headshots with Vex among them.');
  });

  it('counts the alerts worth a look', () => {
    assert.equal(alertCount({ steam: { accounts: [{}, {}] }, totals: { flaggedPlayers: 3 } }), 5);
    assert.equal(alertCount({ steam: null, totals: { flaggedPlayers: 0 } }), 0);
  });
});

describe('the staff page kills tab', () => {
  const flag = { kills: 10, odds: 1000 };

  it('counts headshots, and what the server’s usual aim gets with the same weapons', () => {
    assert.equal(headshotCount(35, 26), '26 of 35 (74%)');
    assert.equal(headshotCount(0, 0), '–');
    assert.equal(usualHeadshots(9.4, 35), '9 (27%)');
    assert.equal(usualHeadshots(null, 35), '–');
    assert.equal(usualHeadshots(0, 0), '–');
  });

  it('gives the chance by luck as one in so many, and only when it is unlikely', () => {
    assert.equal(luckOdds(0.3), 'Ordinary');
    assert.equal(luckOdds(0.05), 'Ordinary');
    assert.equal(luckOdds(0.02), '1 in 50');
    assert.equal(luckOdds(1 / 4812), '1 in 4,800');
    assert.equal(luckOdds(1 / 2_345_678), '1 in 2.3 million');
    assert.equal(luckOdds(1e-12), 'Under 1 in a billion');
    assert.equal(luckOdds(0), 'Under 1 in a billion');
    assert.equal(luckOdds(null), '–');
  });

  it('knows whose headshots are nothing to look at: ordinary by luck, with no flagged day', () => {
    assert.equal(ordinaryHeadshots({ chance: 0.3, flaggedDays: 0 }), true);
    assert.equal(ordinaryHeadshots({ chance: 0.05, flaggedDays: 0 }), true);
    assert.equal(ordinaryHeadshots({ chance: 0.02, flaggedDays: 0 }), false);
    assert.equal(ordinaryHeadshots({ chance: 0.3, flaggedDays: 1 }), false);
    // Not enough kills to judge: not called ordinary.
    assert.equal(ordinaryHeadshots({ chance: null, flaggedDays: 0 }), false);
  });

  it('colours a chance below the flag’s mark, and one below 1 in 20', () => {
    assert.equal(oddsKind(0.0009, flag), 'bad');
    assert.equal(oddsKind(0.001, flag), 'hot');
    assert.equal(oddsKind(0.04, flag), 'hot');
    assert.equal(oddsKind(0.3, flag), '');
    assert.equal(oddsKind(null, flag), '');
  });

  it('words the flag with the bot’s marks', () => {
    assert.match(headshotRule(flag), /^10 or more kills in a day, .* less than once in 1,000 days$/);
    assert.equal(flaggedDaysLabel(1), 'Flagged 1 day');
    assert.equal(flaggedDaysLabel(3), 'Flagged 3 days');
  });

  it('sums up a player’s headshots in words', () => {
    assert.equal(
      killerSummary({ kills: 35, headshots: 26, expected: 9.4, chance: 1 / 2_345_678 }),
      '26 headshots in 35 kills (74%). A player with the server’s usual aim would get about 9 with the same weapons (27%). ' +
        'The chance of 26 or more by luck: 1 in 2.3 million.',
    );
    assert.match(killerSummary({ kills: 20, headshots: 5, expected: 5.2, chance: 0.55 }), /\(26%\)\. Nothing unusual\.$/);
    assert.match(killerSummary({ kills: 1, headshots: 1, expected: null, chance: null }), /^1 headshot in 1 kill \(100%\)\. The server needs more kills/);
    assert.equal(killerSummary({ kills: 0, headshots: 0, expected: null, chance: null }), 'No kills in this period.');
  });
});

describe('announcement', () => {
  const notice = {
    show: true,
    title: 'Server problems',
    message: 'Our server may be offline.',
    link: { text: 'Updates on our Discord', href: 'https://discord.gg/qsJFYGhSJ4' },
  };

  it('shows the title, message and link', () => {
    assert.deepEqual(announcement(notice), {
      title: 'Server problems',
      message: 'Our server may be offline.',
      link: { href: 'https://discord.gg/qsJFYGhSJ4', text: 'Updates on our Discord' },
    });
  });

  it('shows nothing unless "show" is true and there is a message', () => {
    assert.equal(announcement({ ...notice, show: false }), null);
    assert.equal(announcement({ ...notice, show: 'true' }), null);
    assert.equal(announcement({ ...notice, show: undefined }), null);
    assert.equal(announcement({ ...notice, message: '  ' }), null);
    assert.equal(announcement({ ...notice, message: 42 }), null);
    assert.equal(announcement(null), null);
    assert.equal(announcement([]), null);
    assert.equal(announcement('Server problems'), null);
  });

  it('trims the text, and leaves the title out when there is none', () => {
    assert.deepEqual(announcement({ show: true, message: ' Back soon. ' }), { title: '', message: 'Back soon.', link: null });
  });

  it('keeps links to web pages and our own pages, and drops the rest', () => {
    const linkTo = (href) => announcement({ ...notice, link: { text: 'More', href } })?.link?.href ?? null;
    assert.equal(linkTo('http://example.com/'), 'http://example.com/');
    assert.equal(linkTo('seeding'), 'seeding');
    assert.equal(linkTo('/#join'), '/#join');
    assert.equal(linkTo('javascript:alert(1)'), null);
    assert.equal(linkTo(' JavaScript:alert(1)'), null);
    assert.equal(linkTo('data:text/html,hi'), null);
    assert.equal(linkTo(''), null);
    assert.equal(announcement({ ...notice, link: { href: 'https://example.com/' } }).link, null);
  });
});

describe('the season page', () => {
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('counts down in days, hours, minutes and seconds, and stops at 0', () => {
    assert.deepEqual(countdown(2 * DAY + 3 * HOUR + 4 * MINUTE + 5_900), { days: 2, hours: 3, minutes: 4, seconds: 5 });
    assert.deepEqual(countdown(-5_000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('says the countdown in words, to the minute', () => {
    assert.equal(countdownText(5 * DAY + 3 * HOUR + 20 * MINUTE), '5 days 3 hours');
    assert.equal(countdownText(DAY + 30 * MINUTE), '1 day');
    assert.equal(countdownText(3 * HOUR + 20 * MINUTE), '3 hours 20 minutes');
    assert.equal(countdownText(HOUR), '1 hour');
    assert.equal(countdownText(4 * MINUTE + 59_000), '4 minutes');
    // Under a minute is still a minute away, not 0.
    assert.equal(countdownText(10_000), '1 minute');
  });

  it("writes a season's UTC days, the end not included", () => {
    const start = Date.UTC(2026, 8, 30);
    const end = Date.UTC(2026, 9, 15);
    // The browser may put thin spaces around the dash.
    const range = (from, to, locale) => dayRange(from, to, locale).replace(/\s/g, ' ');
    assert.equal(range(start, end, 'en-US'), 'Sep 30 – Oct 14, 2026');
    assert.match(range(start, end, 'en-GB'), /^30 Sept? – 14 Oct 2026$/);
    // A season of one day, or one still going part of the way through its first day.
    assert.equal(dayRange(start, start + DAY, 'en-US'), 'Sep 30, 2026');
    assert.equal(dayRange(start, start + 5 * HOUR, 'en-US'), 'Sep 30, 2026');
    // A season still going, part of the way through its tenth day, has that day.
    assert.equal(range(start, start + 9 * DAY + 8 * HOUR, 'en-US'), 'Sep 30 – Oct 9, 2026');
  });

  it('writes a lot of hours in whole hours', () => {
    assert.equal(manyHours(45), '45 min');
    assert.equal(manyHours(90), '2 h');
    assert.equal(manyHours(5_000 * 60), '5,000 h');
    assert.equal(manyHours(12_345 * 60), '12.3K h');
  });

  it("shows each board's numbers from the roundup's rows", () => {
    const cells = Object.fromEntries(SEASON_BOARDS.map((b) => [b.key, b]));
    assert.deepEqual(cells.kills.cells({ kills: 1054 }), ['1,054']);
    assert.deepEqual(cells.kd.cells({ kd: 2.876 }), ['2.88']);
    assert.equal(cells.kd.sub({ kdMinMatches: 5 }), 'At least 5 matches.');
    assert.deepEqual(cells.bestMatch.cells({ kills: 41, map: 'Ozeti' }), ['41', 'Ozeti']);
    assert.deepEqual(cells.wins.cells({ wins: 30, played: 41 }), ['30', '41']);
    assert.deepEqual(cells.playtime.cells({ minutes: 7562 }), ['126 h']);
    assert.deepEqual(cells.seeding.cells({ seedDays: 5, minutes: 280 }), ['5', '4.7 h']);
    assert.deepEqual(Object.keys(ROLE_AWARDS), ['assault', 'support', 'machine-gun', 'marksman', 'demolition', 'vehicle-gun']);
  });

  it('lists the shout-outs somebody earned, in order', () => {
    const ash = { name: 'Ash', id: 'aaaaaaaaaaaa' };
    const roundup = {
      awards: {
        headshots: { ...ash, headshots: 1 },
        longest: { ...ash, distance: 642.4, weapon: 'SV98' },
        variety: null,
        roadKills: null,
        melee: { ...ash, kills: 3 },
        sidearm: null,
      },
      regular: { ...ash, days: 14, of: 15 },
      rookie: null,
    };
    assert.deepEqual(
      shoutOuts(roundup).map((s) => [s.title, s.player.name, s.detail]),
      [
        ['Headhunter', 'Ash', '1 headshot'],
        ['Longest shot', 'Ash', '642 m with the SV98'],
        ['Bonk', 'Ash', '3 melee kills'],
        ['Ever-present', 'Ash', 'On 14 of 15 days'],
      ],
    );
    // Without the kill feed, only the player records' shout-outs.
    assert.deepEqual(
      shoutOuts({ ...roundup, awards: null }).map((s) => s.title),
      ['Ever-present'],
    );
  });
});
