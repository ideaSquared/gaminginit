import { FACTION_HEX } from './format.js';
import { lineProblem, linesToSave, sameLines } from './linesmodel.js';
import { ruleProblem, tidy } from './rulesmodel.js';

// Made-up numbers in the same shape as the bot's /api/stats, for previewing the page: open it with ?demo.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Players by UTC hour on a typical day: quiet overnight, filling up through the evening.
const CURVE = [38, 24, 10, 4, 0, 0, 0, 0, 2, 4, 6, 9, 14, 18, 22, 26, 31, 40, 52, 61, 64, 60, 55, 46];
const NAMES = ['Kestrel', 'Bravo_Six', 'Moth', 'Nightjar', 'Pike', 'Rook', 'Sable', 'Tusk', 'Vex', 'Ash'];
const MAPS = ['Bakurani', 'Ozeti', 'Zestafona'];
// As on the bot: the K/D board only lists players with this many matches over 30 days.
const KD_MIN_MATCHES = 10;
const CAPACITY = 64;
const LIVE = 20;
// Busy near full, like the real server's 97+ of its slots.
const BUSY = 60;

// Deterministic wobble, so the preview looks the same on every load.
const wobble = (n) => Math.sin(n * 0.11) * 0.6 + Math.sin(n * 0.029) * 0.4;

const playersAt = (at) => {
  const hours = (at % DAY) / HOUR;
  const i = Math.floor(hours);
  const from = CURVE[i];
  const to = CURVE[(i + 1) % 24];
  const base = from + (to - from) * (hours - i);
  if (base === 0) return 0;
  return Math.max(0, Math.min(CAPACITY, Math.round(base + wobble(at / MINUTE) * 2)));
};

// Each sample player's id, shaped like the bot's: 12 hex characters.
const demoId = (i) => `d${String(i).padStart(11, '0')}`;
const idOf = (name) => demoId(NAMES.indexOf(name));

const top = (seed, count = 5) =>
  NAMES.slice(seed % 4, (seed % 4) + count).map((name, i) => ({
    id: idOf(name),
    name,
    kills: 24 - i * 4 + (seed % 3),
    deaths: 6 + ((i + seed) % 5),
  }));

const scores = (seed) => [
  { name: 'Valkyra', score: 300 - (seed % 2) * 55 },
  { name: 'Kharr', score: 255 + (seed % 2) * 45 },
];

// A finished match's scores: three sides in their colours in game, a different winner each time.
const finalScores = (seed) => {
  const points = [300, 255 - (seed % 3) * 20, 140 + (seed % 4) * 10];
  return SIDES.map((name, i) => ({ name, score: points[(i + seed) % 3], colorHex: SIDE_COLOURS[name] }));
};

export const demoStats = (now) => {
  const minute = Math.floor(now / MINUTE) * MINUTE;
  const history = [];
  for (let at = minute - DAY + MINUTE; at <= minute; at += MINUTE) {
    // A 12-minute gap each morning, like a daily server restart.
    const restart = ((at % DAY) / MINUTE) - 7 * 60;
    if (restart >= 0 && restart < 12) continue;
    history.push([at, playersAt(at)]);
  }
  const players = history.at(-1)?.[1] ?? 0;
  const phase = players >= LIVE ? 'live' : players > 0 ? 'seeding' : 'empty';
  const today = Math.floor(now / DAY) * DAY;

  return {
    generatedAt: now,
    thresholds: { seeding: 1, live: LIVE, busy: BUSY },
    server: {
      name: 'gaminginit #1',
      players,
      maxPlayers: CAPACITY,
      map: 'Ozeti',
      phase,
      factionScores: players > 0 ? scores(1).map((s) => ({ ...s, score: Math.round(s.score / 3) })) : [],
      seenAt: minute,
    },
    history,
    days: Array.from({ length: 14 }, (_, i) => {
      const day = new Date(today - (13 - i) * DAY).toISOString().slice(0, 10);
      if (i < 13) return { day, peak: 42 + Math.round(wobble(i + 3) * 20), liveMinutes: 260 + Math.round(wobble(i + 9) * 120) };
      const sofar = history.filter(([at]) => at >= today).map(([, p]) => p);
      return { day, peak: Math.max(0, ...sofar), liveMinutes: sofar.filter((p) => p >= LIVE).length };
    }),
    matches: Array.from({ length: 10 }, (_, i) => ({
      map: MAPS[i % MAPS.length],
      endedAt: minute - (i + 1) * 55 * MINUTE - 10 * HOUR,
      durationMs: (38 + ((i * 7) % 20)) * MINUTE,
      peakPlayers: 64 - ((i * 5) % 18),
      factionScores: finalScores(i),
      top: top(i),
    })),
    currentMatch:
      players > 0
        ? {
            map: 'Ozeti',
            startedAt: minute - 31 * MINUTE,
            liveAt: phase === 'live' ? minute - 23 * MINUTE : null,
            peakPlayers: players + 2,
            factionScores: scores(1).map((s) => ({ ...s, score: Math.round(s.score / 3) })),
            top: top(2),
          }
        : null,
    discord: { name: 'gaminginit', members: 1284, online: 213, fetchedAt: minute },
    leaderboard: leaderboard(),
    recentSeeders: recentSeeders(),
    weapons: weapons(now),
    vip: { seedDays: 3, seedMinutes: 10, windowDays: 7, lengthDays: 7 },
    seederVip: seederVip(now),
    teams: teamBoard(now),
    // Average players in each UTC hour over the last 14 days, and the share of readings with BUSY players or more.
    hourly: {
      days: 14,
      players: CURVE.map((p, hour) => Math.max(0, p + wobble(hour * 7) * 3)),
      busy: CURVE.map((p) => Math.max(0, Math.min(1, (p - 55) / 10))),
    },
  };
};

// Thirty days of made-up totals for ten regulars.
const leaderboard = () => {
  const players = NAMES.map((name, i) => ({
    id: demoId(i),
    name,
    seedingMinutes: [410, 95, 260, 30, 180, 0, 520, 75, 140, 12][i],
    liveMinutes: 1900 - i * 150 + (i % 3) * 90,
    seedDays: [9, 2, 6, 1, 4, 0, 11, 2, 3, 0][i],
    matches: 42 - i * 3,
    kills: 820 - i * 61 + (i % 4) * 40,
    deaths: 310 - i * 14 + (i % 3) * 25,
  }));
  const by = (value) => [...players].sort((a, b) => value(b) - value(a));
  return {
    days: 30,
    kdMinMatches: KD_MIN_MATCHES,
    kills: by((p) => p.kills),
    kd: by((p) => p.kills / Math.max(p.deaths, 1)).filter((p) => p.matches >= KD_MIN_MATCHES),
    playtime: by((p) => p.seedingMinutes + p.liveMinutes),
    seeding: by((p) => p.seedDays * 1e6 + p.seedingMinutes).filter((p) => p.seedingMinutes > 0),
  };
};

// The last 7 days of the same regulars' seeding: no more than 7 seed days, and a week's share of the minutes.
const recentSeeders = () => {
  const { seeding } = leaderboard();
  const rows = seeding
    .map((p) => ({ ...p, seedDays: Math.min(p.seedDays, 7), seedingMinutes: Math.round(p.seedingMinutes / 4) }))
    .filter((p) => p.seedingMinutes > 0)
    .sort((a, b) => b.seedDays - a.seedDays || b.seedingMinutes - a.seedingMinutes);
  return { days: 7, rows };
};

// Who has VIP from seeding: the regulars with 3 seed days or more, each with some of their week left.
const seederVip = (now) =>
  [6, 0, 2, 4, 8].map((i, k) => ({ id: demoId(i), name: NAMES[i], until: now + (6 - k) * DAY + 3 * HOUR }));

// Thirty days of made-up results: each map's wins by team (in SIDES order) and average minutes.
const TEAM_MAPS = [
  ['Ozeti', [28, 21, 13], 41],
  ['Bakurani', [15, 22, 14], 38],
  ['Zestafona', [12, 9, 9], 46],
];

const teamBoard = (now) => {
  const SIDES = ['Valkyra', 'Lonestar', 'Manticore'];
  const maps = TEAM_MAPS.map(([map, wins, minutes]) => ({
    map,
    matches: wins.reduce((a, b) => a + b, 0),
    averageMs: minutes * MINUTE,
    teams: SIDES.map((name, i) => ({ name, wins: wins[i] })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
  }));
  const matches = maps.reduce((sum, m) => sum + m.matches, 0);
  const scores = (list) => list.map(([name, score]) => ({ name, score, colorHex: SIDE_COLOURS[name] }));
  return {
    days: 30,
    matches,
    averageMs: Math.round(maps.reduce((sum, m) => sum + m.averageMs * m.matches, 0) / matches),
    teams: SIDES.map((name, i) => ({
      name,
      colorHex: SIDE_COLOURS[name],
      matches,
      wins: TEAM_MAPS.reduce((sum, [, wins]) => sum + wins[i], 0),
    })).sort((a, b) => b.wins - a.wins),
    maps,
    streak: { name: 'Valkyra', wins: 4 },
    closest: { map: 'Ozeti', endedAt: now - 2 * DAY, durationMs: 52 * MINUTE, factionScores: scores([['Valkyra', 300], ['Lonestar', 299], ['Manticore', 210]]) },
    biggest: { map: 'Bakurani', endedAt: now - 9 * DAY, durationMs: 24 * MINUTE, factionScores: scores([['Lonestar', 300], ['Valkyra', 64], ['Manticore', 41]]) },
  };
};

// The sample's weapons: name, kind, kills over 30 days, share of headshots, average and longest distance in metres.
const WEAPONS = [
  ['AK74', 'weapon', 1843, 0.27, 48, 412],
  ['M4', 'weapon', 1622, 0.31, 52, 388],
  ['PKM', 'weapon', 911, 0.14, 61, 503],
  ['SVD', 'weapon', 604, 0.46, 187, 846],
  ['M249 SAW', 'weapon', 552, 0.12, 44, 297],
  ['M67 frag grenade', 'weapon', 318, 0, 14, 41],
  ['Humvee minigun', 'vehicle-weapon', 241, 0.05, 96, 402],
  ['RPG-7', 'weapon', 187, 0, 63, 311],
  ['Mosin Nagant', 'weapon', 142, 0.58, 211, 977],
  ['Barbed wire', 'buildable', 66, 0, 1.2, 3.1],
];

// The last 30 days by weapon, as the bot adds up the kill feed. The feed started 12 days ago, so the page says so.
const weapons = (now) => {
  const top = WEAPONS.map(([name, kind, kills, share, average, longest], i) => ({
    name,
    kind,
    kills,
    headshots: Math.round(kills * share),
    averageDistance: average,
    longest: { distance: longest, name: NAMES[(i * 3) % NAMES.length], id: demoId((i * 3) % NAMES.length) },
  }));
  const kills = top.reduce((sum, w) => sum + w.kills, 0) + 412;
  // Hand-held weapons only, as the bot does.
  const longest = top.filter((w) => w.kind === 'weapon').reduce((best, w) => (w.longest.distance > best.longest.distance ? w : best));
  return {
    days: 30,
    since: new Date(now - 12 * DAY).toISOString().slice(0, 10),
    kills,
    headshots: top.reduce((sum, w) => sum + w.headshots, 0) + 40,
    top,
    longest: { weapon: longest.name, ...longest.longest },
  };
};

// A made-up Season 1, the same shape as the bot's /api/season once the season is over. `locked` gives the page before
// it opens instead, with the season ending in 3 days.
export const demoSeason = (now, { locked = false } = {}) => {
  const page = { number: 1, name: 'Season 1' };
  if (locked) return { ...page, endsAt: Math.ceil((now + 3 * DAY) / HOUR) * HOUR, open: false, roundup: null };
  const start = Date.UTC(2026, 8, 30);
  const end = Date.UTC(2026, 9, 15);
  const player = (i) => ({ name: NAMES[i % NAMES.length], id: demoId(i % NAMES.length) });
  // Each board: the regulars in a different order, falling away down the board.
  const board = (offset, row) => NAMES.map((_, i) => ({ ...player((i * 3 + offset) % NAMES.length), ...row(i) }));
  const scores = (list) => list.map(([name, score]) => ({ name, score, colorHex: SIDE_COLOURS[name] }));
  const days = Array.from({ length: 15 }, (_, i) => {
    const players = 640 + Math.round(wobble(i * 9 + 4) * 260) + (i % 7 >= 5 ? 180 : 0);
    const matches = 5 + Math.round(wobble(i * 5 + 1) * 2 + 1);
    return { day: new Date(start + i * DAY).toISOString().slice(0, 10), players, minutes: players * 96, matches, peak: 60 + (i % 5) };
  });
  const matches = days.reduce((sum, d) => sum + d.matches, 0);
  const busiest = days.reduce((best, d) => (d.players > best.players ? d : best));
  // The season's matches with a result, by map: two of them ended level, so they have none.
  const seasonMaps = [
    ['Ozeti', [20, 15, 9], 41],
    ['Bakurani', [11, 16, 10], 38],
    ['Zestafona', [8, 6, 5], 46],
  ];
  const maps = seasonMaps.map(([map, wins, minutes]) => ({
    map,
    matches: wins.reduce((a, b) => a + b, 0),
    averageMs: minutes * MINUTE,
    teams: SIDES.map((name, i) => ({ name, wins: wins[i] })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
  }));
  const decided = maps.reduce((sum, m) => sum + m.matches, 0);
  const teams = SIDES.map((name, i) => {
    const wins = seasonMaps.reduce((sum, [, w]) => sum + w[i], 0);
    return { name, colorHex: SIDE_COLOURS[name], matches: decided, wins, losses: decided - wins };
  }).sort((a, b) => b.wins - a.wins);
  const ended = (day, hour) => start + day * DAY + hour * HOUR;
  const totalPlayers = days.reduce((sum, d) => sum + d.players, 0);
  const kills = WEAPONS.reduce((sum, w) => sum + w[2], 0) * 2;
  return {
    ...page,
    endsAt: end,
    open: true,
    roundup: {
      kind: 'season',
      start,
      end,
      partial: false,
      matches,
      playedMs: matches * 43 * MINUTE,
      players: 2418,
      peakPlayers: 64,
      busiestDay: { day: busiest.day, players: busiest.players },
      teams,
      bestTeam: teams[0],
      teamMinMatches: 3,
      kdMinMatches: 10,
      kills: board(0, (i) => ({ kills: 1210 - i * 83 })),
      kd: board(4, (i) => ({ kd: 3.42 - i * 0.21 })),
      bestMatch: board(2, (i) => ({ kills: 48 - i * 3, deaths: 6 + (i % 4), map: MAPS[i % MAPS.length] })),
      wins: board(6, (i) => ({ wins: 44 - i * 3, played: 70 - i * 4 })),
      mvps: board(1, (i) => ({ mvps: 17 - i })),
      playtime: board(8, (i) => ({ minutes: 9200 - i * 610 })),
      seeding: board(5, (i) => ({ seedDays: 12 - i, minutes: 940 - i * 70 })),
      biggestWin: { map: 'Bakurani', endedAt: ended(3, 21), factionScores: scores([['Lonestar', 100], ['Valkyra', 12], ['Manticore', 8]]) },
      closestMatch: { map: 'Ozeti', endedAt: ended(9, 22), factionScores: scores([['Valkyra', 100], ['Manticore', 99], ['Lonestar', 61]]) },
      topMap: { map: 'Ozeti', matches: maps[0].matches },
      regular: { ...player(6), days: 15, of: 15 },
      rookie: null,
      awards: {
        from: '2026-10-04',
        roles: ['assault', 'support', 'machine-gun', 'marksman', 'demolition', 'vehicle-gun'].map((role, r) => ({
          role,
          top: NAMES.slice(0, 10).map((_, i) => ({ ...player(i + r * 2), kills: Math.round((540 - r * 70) * (1 - i * 0.09)) })),
        })),
        headshots: { ...player(3), headshots: 412 },
        longest: { ...player(7), distance: 977.4, weapon: 'Mosin Nagant' },
        variety: { ...player(5), weapons: 29 },
        roadKills: { ...player(2), kills: 37 },
        melee: { ...player(9), kills: 21 },
        sidearm: { ...player(4), kills: 66 },
      },
      days,
      totals: { kills, deaths: Math.round(kills * 1.08), minutes: totalPlayers * 96, seedingMinutes: 61_400, seedDays: 812 },
      averageMs: Math.round(maps.reduce((sum, m) => sum + m.averageMs * m.matches, 0) / decided),
      maps,
      streak: { name: 'Valkyra', colorHex: SIDE_COLOURS.Valkyra, wins: 9, from: ended(5, 18), to: ended(6, 23) },
      longestMatch: { map: 'Zestafona', endedAt: ended(12, 23), durationMs: 97 * MINUTE, factionScores: scores([['Manticore', 100], ['Valkyra', 94], ['Lonestar', 88]]) },
      quickestWin: { map: 'Bakurani', endedAt: ended(3, 21), durationMs: 19 * MINUTE, factionScores: scores([['Lonestar', 100], ['Valkyra', 12], ['Manticore', 8]]) },
      deaths: board(7, (i) => ({ deaths: 812 - i * 47, kills: 390 - i * 21 })),
      teamKills: board(3, (i) => ({ teamKills: 17 - i })),
      weapons: { ...weapons(end - DAY), days: 15, since: '2026-10-04', top: weapons(end - DAY).top.map((w) => ({ ...w, kills: w.kills * 2, headshots: w.headshots * 2 })), kills, headshots: Math.round(kills * 0.24) },
    },
  };
};

const SIDES = ['Valkyra', 'Lonestar', 'Manticore'];
// Made-up colours for the sample; the real ones come from the game server.
const SIDE_COLOURS = FACTION_HEX;
const PROFILE_DAYS = 90;
const VIP_RULE = { seedDays: 3, seedMinutes: 10, windowDays: 7, lengthDays: 7 };

// Everyone in the sample, for the players page: the regulars, then occasional players.
export const demoPlayers = (now) => {
  const today = new Date(now).toISOString().slice(0, 10);
  const online = playersAt(Math.floor(now / MINUTE) * MINUTE) > 0;
  const extras = ['Gale', 'Hollow', 'Ibis', 'Juno', 'Kite', 'Lark', 'Mako', 'Nova', 'Onyx', 'Quill', 'Ruin', 'Sprocket'];
  return {
    generatedAt: now,
    days: PROFILE_DAYS,
    players: [...NAMES, ...extras].map((name, i) => ({
      id: demoId(i),
      name,
      minutes: Math.round(2400 / (1 + i * 0.45)),
      lastSeen: new Date(now - (i < 6 ? 0 : (i % 9) * DAY)).toISOString().slice(0, 10),
      online: online && i < 6,
    })),
  };
};

// One sample player's page, or null for an id that is not in the sample.
export const demoProfile = (id, now) => {
  const index = demoPlayers(now).players.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const name = demoPlayers(now).players[index].name;
  const today = Math.floor(now / DAY) * DAY;
  const keen = Math.max(0.25, 1 - index * 0.08);
  const activity = [];
  const matches = [];
  for (let ago = PROFILE_DAYS - 1; ago >= 0; ago--) {
    const n = ago + index * 13;
    // Plays most evenings, more at weekends, with a quiet spell a month ago.
    const weekend = [0, 6].includes(new Date(today - ago * DAY).getUTCDay());
    const chance = (wobble(n * 3.7) + 1) / 2 + (weekend ? 0.25 : 0) - (ago > 30 && ago < 38 ? 0.6 : 0);
    if (chance < 1.3 - keen) continue;
    const games = 1 + Math.round(((wobble(n) + 1) / 2) * 2 * keen);
    const day = { day: new Date(today - ago * DAY).toISOString().slice(0, 10), seedingMinutes: 0, liveMinutes: 0, seedDays: 0, matches: 0, kills: 0, deaths: 0 };
    if ((n + index) % 3 === 0) {
      day.seedingMinutes = 15 + ((n * 7) % 40);
      day.seedDays = 1;
    }
    for (let g = 0; g < games; g++) {
      const k = n * 5 + g;
      const kills = Math.max(0, Math.round(9 + wobble(k * 1.3) * 8 + keen * 6));
      const deaths = Math.max(1, Math.round(8 + wobble(k * 0.7 + 2) * 5));
      const faction = SIDES[(k + index) % 3];
      const won = wobble(k * 2.1) + keen * 0.15 > 0;
      const others = SIDES.filter((side) => side !== faction);
      // The winner reaches 100; the others trail.
      const order = won ? [faction, ...others] : [others[k % 2], faction, others[(k + 1) % 2]];
      const factionScores = order.map((name, i) => ({ name, score: i === 0 ? 100 : 40 + ((k * (13 + i * 7)) % 55) - i * 10, colorHex: SIDE_COLOURS[name] }));
      const endedAt = today - ago * DAY + (19 + g) * HOUR + ((k * 17) % 50) * MINUTE;
      // Tonight's matches have not happened yet.
      if (endedAt > now) continue;
      matches.push({
        map: MAPS[k % MAPS.length],
        endedAt,
        durationMs: (38 + ((k * 7) % 20)) * MINUTE,
        kills,
        deaths,
        place: Math.max(1, Math.round(1 + (1 - keen) * 20 + wobble(k * 0.9) * 8)),
        players: 60 + ((k * 3) % 38),
        faction,
        result: won ? 'won' : 'lost',
        factionScores,
      });
      day.liveMinutes += 40 + ((k * 11) % 15);
      day.matches += 1;
      day.kills += kills;
      day.deaths += deaths;
    }
    activity.push(day);
  }
  matches.sort((a, b) => b.endedAt - a.endedAt);
  const ranked = new Date(today - 29 * DAY).toISOString().slice(0, 10);
  const matchesRanked = activity.filter((d) => d.day >= ranked).reduce((sum, d) => sum + d.matches, 0);
  const online = demoPlayers(now).players[index].online;
  // Their kills each day since the sample's kill feed started, shared out over a few favourite weapons.
  const since = new Date(now - 12 * DAY).toISOString().slice(0, 10);
  const favourites = [0, 1, 3, 2, 5, 6, 8, 9].map((w) => WEAPONS[(w + index) % WEAPONS.length]);
  const used = activity
    .filter((d) => d.day >= since && d.kills > 0)
    .flatMap((d, n) => {
      let left = d.kills;
      return favourites.flatMap(([name, kind, , share, average, longest], w) => {
        const kills = w === favourites.length - 1 ? left : Math.min(left, Math.round(d.kills * [0.4, 0.25, 0.12, 0.08, 0.05, 0.04, 0.03, 0.03][w]));
        left -= kills;
        if (kills <= 0) return [];
        const far = Math.round(average + ((longest - average) * ((n * 7 + w * 3) % 10)) / 10);
        return [{ day: d.day, name, kind, kills, headshots: Math.round(kills * share), longest: far }];
      });
    });
  return {
    generatedAt: now,
    id,
    name,
    days: PROFILE_DAYS,
    activity: activity.filter((d) => d.matches > 0 || d.seedingMinutes > 0),
    matches,
    ranks: {
      days: 30,
      kdMinMatches: KD_MIN_MATCHES,
      players: 214,
      kills: index + 1,
      kd: matchesRanked < KD_MIN_MATCHES ? null : index < 5 ? 5 - index : 14 + index,
      playtime: index * 2 + 2,
      seeding: index === 0 ? 1 : null,
    },
    online: online ? { map: 'Ozeti', faction: 'Valkyra', kills: 11 - index, deaths: 3 + index } : null,
    vip: index % 2 === 0 ? { until: today + 5 * DAY + 4 * HOUR } : null,
    seeding: { rule: VIP_RULE, seedDays: Math.min(3, (index + 1) % 4) },
    weapons: { since, used },
  };
};

// A sample live match for the live page: a match that starts again every 45 minutes, with a death every 2 to 10
// seconds, worked out the same way the bot does from the kill feed. The same moment always gives the same match.
const LIVE_CYCLE = 45 * MINUTE;
const LIVE_ROSTER = ['Kestrel', 'Bravo_Six', 'Moth', 'Nightjar', 'Pike', 'Rook', 'Sable', 'Tusk', 'Vex', 'Ash', 'Gale', 'Hollow', 'Ibis', 'Juno', 'Kite', 'Lark'];
const LIVE_SIDES = ['Valkyra', 'Lonestar'];
const MULTI_SECONDS = 8;
const ON_FIRE = 5;

// A number from 0 to 1 that only depends on its arguments.
const chance = (n, salt) => {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const demoLive = (now) => {
  const start = Math.floor(now / LIVE_CYCLE) * LIVE_CYCLE;
  const side = (i) => LIVE_SIDES[i % 2];
  const players = LIVE_ROSTER.map((name, i) => ({
    i,
    name,
    id: i < NAMES.length ? demoId(i) : undefined,
    faction: side(i),
    kills: 0,
    deaths: 0,
    headshots: 0,
    teamKills: 0,
    streak: 0,
    bestStreak: 0,
    chain: 0,
    chainTime: null,
    bestChain: 0,
    longest: null,
    longestWeapon: null,
    weapons: {},
  }));
  const ref = (p) => ({ name: p.name, ...(p.id ? { id: p.id } : {}), faction: p.faction });
  const pairs = new Map();
  const feed = [];
  let firstBlood = null;
  let totals = { kills: 0, headshots: 0, teamKills: 0, otherDeaths: 0 };
  let at = start + 25_000;
  let lastKiller = null;
  for (let k = 0; at <= now; k++) {
    const time = (at - start) / 1000;
    // Better players kill more; a burst keeps the same killer going.
    const burst = lastKiller !== null && chance(k, 1) < 0.28;
    const killer = burst ? lastKiller : players[Math.floor(chance(k, 2) ** 1.7 * players.length)];
    const fall = chance(k, 3) < 0.04;
    const teamKill = !fall && chance(k, 4) < 0.02;
    const victims = players.filter((p) => p !== killer && (teamKill ? p.faction === killer.faction : p.faction !== killer.faction));
    const victim = victims[Math.floor(chance(k, 5) * victims.length)];
    const [weapon, kind, , share, average, longest] = WEAPONS[Math.floor(chance(k, 6) ** 1.4 * WEAPONS.length)];
    const distance = kind === 'buildable' ? 1 + chance(k, 7) * 2 : Math.round(average * (0.3 + chance(k, 7) * 1.4) * 10) / 10;
    const headshot = !fall && !teamKill && chance(k, 8) < share;
    const tags = fall ? ['Falling'] : chance(k, 9) < 0.03 ? ['Penetration'] : [];
    const entry = { id: `demo-${start}-${k}`, at, victim: ref(victim), headshot, teamKill, tags, streak: 0, chain: 0 };
    if (fall) {
      Object.assign(entry, { killer: null, weapon: null, kind: null, distance: null });
      totals.otherDeaths += 1;
      lastKiller = null;
    } else {
      const capped = Math.min(distance, longest);
      Object.assign(entry, { killer: ref(killer), weapon, kind, distance: capped });
      if (teamKill) {
        killer.teamKills += 1;
        totals.teamKills += 1;
      } else {
        killer.kills += 1;
        killer.headshots += headshot ? 1 : 0;
        killer.streak += 1;
        killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
        killer.chain = killer.chainTime !== null && time - killer.chainTime <= MULTI_SECONDS ? killer.chain + 1 : 1;
        killer.chainTime = time;
        killer.bestChain = Math.max(killer.bestChain, killer.chain);
        if (kind === 'weapon' && (killer.longest === null || capped > killer.longest)) {
          killer.longest = capped;
          killer.longestWeapon = weapon;
        }
        killer.weapons[weapon] = (killer.weapons[weapon] ?? 0) + 1;
        pairs.set(`${killer.i}:${victim.i}`, (pairs.get(`${killer.i}:${victim.i}`) ?? 0) + 1);
        totals.kills += 1;
        totals.headshots += headshot ? 1 : 0;
        Object.assign(entry, { streak: killer.streak, chain: killer.chain });
        firstBlood ??= { killer: ref(killer), victim: ref(victim), weapon };
      }
      lastKiller = killer;
    }
    victim.deaths += 1;
    victim.streak = 0;
    victim.chain = 0;
    victim.chainTime = null;
    feed.push(entry);
    at += (burst ? 2 + chance(k, 10) * 4 : 3 + chance(k, 10) * 7) * 1000;
  }

  const top = (value, least) => players.reduce((best, p) => (value(p) >= least && (best === null || value(p) > value(best)) ? p : best), null);
  const longest = top((p) => p.longest ?? -1, 0);
  const streak = top((p) => p.bestStreak, 3);
  const multi = top((p) => p.bestChain, 2);
  const headshots = top((p) => p.headshots, 1);
  const rivalry = [...pairs].reduce((best, pair) => (pair[1] >= 3 && (best === null || pair[1] > best[1]) ? pair : best), null);
  const weapons = new Map();
  for (const p of players) for (const [name, kills] of Object.entries(p.weapons)) weapons.set(name, (weapons.get(name) ?? 0) + kills);
  const favourite = (p) => Object.entries(p.weapons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const score = (faction) => Math.min(100, Math.round(players.filter((p) => p.faction === faction).reduce((sum, p) => sum + p.kills, 0) / 3));
  const factionScores = LIVE_SIDES.map((name) => ({ name, score: score(name), colorHex: SIDE_COLOURS[name] }));
  const scoreboard = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const minute = Math.floor(now / MINUTE) * MINUTE;
  return {
    generatedAt: now,
    feed: true,
    server: { name: 'gaminginit #1', players: 62, maxPlayers: CAPACITY, map: 'Zestafona', phase: 'live', factionScores, seenAt: minute },
    currentMatch: {
      map: 'Zestafona',
      startedAt: start,
      liveAt: start,
      peakPlayers: 62,
      factionScores,
      top: scoreboard.slice(0, 5).map((p) => ({ ...ref(p), kills: p.kills, deaths: p.deaths })),
    },
    match:
      feed.length === 0
        ? null
        : {
            map: 'Zestafona',
            startedAt: feed[0].at,
            lastKillAt: feed.at(-1).at,
            ...totals,
            feed: feed.slice(-40).reverse(),
            players: scoreboard.slice(0, 10).map((p) => ({
              ...ref(p),
              kills: p.kills,
              deaths: p.deaths,
              headshots: p.headshots,
              teamKills: p.teamKills,
              streak: p.streak,
              bestStreak: p.bestStreak,
              weapon: favourite(p),
            })),
            weapons: [...weapons]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, kills]) => ({ name, kind: WEAPONS.find((w) => w[0] === name)[1], kills })),
            highlights: {
              firstBlood,
              longest: longest && { player: ref(longest), weapon: longest.longestWeapon, distance: longest.longest },
              bestStreak: streak && { player: ref(streak), streak: streak.bestStreak },
              onFire: players
                .filter((p) => p.streak >= ON_FIRE)
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 3)
                .map((p) => ({ player: ref(p), streak: p.streak })),
              bestMultiKill: multi && { player: ref(multi), kills: multi.bestChain },
              mostHeadshots: headshots && { player: ref(headshots), headshots: headshots.headshots },
              rivalry: rivalry && (() => {
                const [k, v] = rivalry[0].split(':').map(Number);
                return { killer: ref(players[k]), victim: ref(players[v]), kills: rivalry[1] };
              })(),
            },
          },
  };
};

// The staff page (GET /api/admin/overview) over the last `days` days, with made-up Steam IDs. Longer periods have more
// of everything, like the real thing.
export const demoAdmin = (days, now) => {
  const steamId = (name) => `7656119800000${String(NAMES.indexOf(name)).padStart(4, '0')}`;
  const ref = (name) => ({ steamId: steamId(name), name, id: idOf(name) });
  const scale = days === 1 ? 1 : days === 7 ? 3 : 8;
  const ago = (minutes) => now - minutes * MINUTE;
  // Those flagged were flagged today, unless said otherwise.
  const row = (name, t) => ({
    ...ref(name),
    teamKills: 0,
    vehicleTeamKills: 0,
    crashTeamKills: 0,
    teamKilled: 0,
    suicides: 0,
    vehicleSuicides: 0,
    mostKilledTeammate: null,
    flags: [],
    flaggedDays: 0,
    lastFlaggedDay: (t.flaggedDays ?? 0) > 0 ? demoDay(now) : null,
    matches: 3 * scale,
    kills: 41 * scale,
    deaths: 33 * scale,
    minutes: 160 * scale,
    banned: false,
    ...t,
  });
  const players = [
    row('Vex', {
      teamKills: 7 * scale,
      vehicleTeamKills: 4 * scale,
      crashTeamKills: 2 * scale,
      suicides: 3 * scale,
      vehicleSuicides: 2 * scale,
      mostKilledTeammate: { ...ref('Moth'), kills: 2 * scale },
      flags: ['teamKills', 'sameTeammate', 'vehicleSuicides'],
      flaggedDays: Math.min(days, 2 * scale - 1),
      banned: days > 1,
    }),
    row('Tusk', { teamKills: 3 * scale, teamKilled: 1, suicides: 12, flags: ['teamKills', 'suicides'], flaggedDays: Math.min(days, scale) }),
    // Flagged, but not in game now: banned since.
    row('Nightjar', {
      teamKills: 3,
      suicides: 2,
      mostKilledTeammate: { ...ref('Kestrel'), kills: 2 },
      flags: ['teamKills', 'sameTeammate'],
      flaggedDays: 1,
      lastFlaggedDay: demoDay(now - DAY),
      matches: 1,
      kills: 9,
      deaths: 14,
      minutes: 52,
      banned: true,
    }),
    row('Pike', { teamKills: 2, vehicleTeamKills: 2, vehicleSuicides: 1, suicides: 4, teamKilled: 2 }),
    row('Moth', { teamKilled: 3 * scale + 1, suicides: 1 }),
    row('Rook', { teamKills: 1, teamKilled: 2, suicides: 2 }),
    row('Sable', { suicides: 3, teamKilled: 1 }),
  ];
  const incident = (minutes, kind, by, victim, weapon, weaponKind, distance, map, tags = []) => ({
    at: ago(minutes),
    kind,
    map,
    player: ref(by),
    victim: victim === null ? null : ref(victim),
    faction: 'Valkyra',
    weapon,
    weaponKind,
    distance,
    tags,
  });
  const incidents = [
    incident(6, 'team-kill', 'Vex', 'Moth', 'Humvee', 'vehicle', 4.2, 'Ozeti', ['RoadKill']),
    incident(9, 'vehicle-suicide', 'Vex', null, 'MH-6', 'vehicle', null, 'Ozeti', ['VehicleExplosion']),
    incident(11, 'team-kill', 'Vex', 'Moth', 'MH-6', 'vehicle', null, 'Ozeti', ['VehicleExplosion']),
    incident(11, 'team-kill', 'Vex', 'Rook', 'MH-6', 'vehicle', null, 'Ozeti', ['VehicleExplosion']),
    incident(24, 'team-kill', 'Tusk', 'Sable', 'M67 frag grenade', 'weapon', 6.8, 'Ozeti'),
    incident(31, 'team-kill', 'Tusk', 'Pike', 'AK74', 'weapon', 18.3, 'Ozeti'),
    incident(52, 'team-kill', 'Pike', 'Moth', 'Kodiak (M249)', 'vehicle', 2.1, 'Bakurani', ['RoadKill']),
    incident(58, 'vehicle-suicide', 'Vex', null, 'Humvee', 'vehicle', null, 'Bakurani', ['VehicleExplosion']),
    incident(75, 'team-kill', 'Vex', 'Moth', 'C4 charge', 'weapon', 3.5, 'Bakurani'),
    incident(96, 'team-kill', 'Tusk', 'Rook', 'M249 SAW', 'weapon', 41.6, 'Bakurani'),
    incident(141, 'team-kill', 'Nightjar', 'Kestrel', 'AK74', 'weapon', 12.4, 'Zestafona'),
    incident(148, 'team-kill', 'Nightjar', 'Ash', 'M67 frag grenade', 'weapon', 7.9, 'Zestafona'),
    incident(155, 'team-kill', 'Nightjar', 'Kestrel', 'AK74', 'weapon', 9.1, 'Zestafona'),
  ];
  const entry = (minutes, action, name, by, byName, reason, detail) => ({
    at: ago(minutes),
    action,
    player: ref(name),
    by,
    ...(byName ? { byName } : {}),
    ...(reason ? { reason } : {}),
    ...(detail ? { detail } : {}),
  });
  const moderation = [
    entry(4, 'warn', 'Vex', '100000000000000001', null, 'Stop team killing with vehicles'),
    entry(13, 'kick', 'Vex', '100000000000000001', 'Sarge', 'Crashed a full heli into the base'),
    ...(days > 1
      ? [
          entry(26 * 60, 'ban', 'Vex', '100000000000000002', 'Kestrel', 'Repeated team killing', '3 days'),
          entry(30 * 60, 'ban', 'Nightjar', 'server', null, 'Racism', 'By Admin'),
          entry(2 * 24 * 60, 'unban', 'Ash', 'bot', null, 'The ban ran out'),
          entry(2 * 24 * 60 + 90, 'vip-add', 'Kestrel', '100000000000000001', 'Sarge', 'Paid: Patreon, October', '30 days'),
          entry(3 * 24 * 60, 'switchteam', 'Rook', '100000000000000001', 'Sarge', null, 'Valkyra to Manticore'),
        ]
      : []),
  ];
  const bans = [
    { player: ref('Nightjar'), reason: 'Racism', bannedBy: 'Admin', onServer: true, bot: null },
    ...(days > 1
      ? [
          {
            player: ref('Vex'),
            reason: 'Repeated team killing (ends …)',
            bannedBy: null,
            onServer: true,
            bot: { by: '100000000000000002', at: ago(26 * 60), until: ago(26 * 60) + 3 * DAY, reason: 'Repeated team killing' },
          },
        ]
      : []),
    {
      player: ref('Bravo_Six'),
      reason: 'Cheating',
      bannedBy: null,
      onServer: false,
      bot: { by: '100000000000000001', at: ago(200), until: null, reason: 'Cheating' },
    },
  ];
  const flagged = players.filter((p) => p.flags.length > 0);
  // Everyone in game now: the sample players and some more, on two teams. Pike has a high-risk Steam account, Vex has
  // team killed today, Ghost_7 is new today, and Kestrel and Moth have VIP.
  const today = new Date(now).toISOString().slice(0, 10);
  const more = ['Ghost_7', 'Falcon', 'Hex', 'Juno', 'Kodiak', 'Lynx', 'Mako', 'Nova', 'Orca', 'Quill', 'Raven', 'Saber', 'Talon', 'Umbra', 'Viper', 'Wren', 'Yeti', 'Zed'];
  const inGame = [...NAMES.filter((n) => n !== 'Bravo_Six' && n !== 'Nightjar'), ...more].map((name, i) => {
    const kills = (i * 7) % 17;
    return {
      ...(NAMES.includes(name) ? ref(name) : { steamId: `7656119800001${String(i).padStart(4, '0')}`, name }),
      faction: i % 2 === 0 ? 'Valkyra' : 'Manticore',
      kills,
      deaths: (i * 5) % 9,
      minutesToday: 20 + ((i * 37) % 260),
      firstSeen: name === 'Ghost_7' ? today : new Date(now - (20 + i) * DAY).toISOString().slice(0, 10),
      steam: name === 'Pike' ? { risk: 'high', score: 5, flags: ['vacBan', 'recentBan', 'hidden'] } : name === 'Sable' ? { risk: 'medium', score: 3, flags: ['gameBan'] } : { risk: 'low', score: 0, flags: [] },
      griefFlags: name === 'Vex' ? ['teamKills', 'sameTeammate'] : [],
      teamKillsToday: name === 'Vex' ? 4 : name === 'Tusk' ? 1 : 0,
      vehicleSuicidesToday: name === 'Vex' ? 2 : 0,
      // Ghost_7 and Pike get far more headshots than their weapons do today; Rook more than usual.
      headshotsToday:
        name === 'Ghost_7'
          ? { kills: 28, headshots: 21, expected: 7.4, chance: 2e-9, flagged: true }
          : name === 'Pike'
            ? { kills: 31, headshots: 24, expected: 9.1, chance: 4e-7, flagged: true }
            : name === 'Rook'
              ? { kills: 14, headshots: 8, expected: 4.1, chance: 0.03, flagged: false }
              : kills > 0
                ? { kills, headshots: Math.round(kills * 0.27), expected: kills * 0.27, chance: 0.5, flagged: false }
                : null,
      banned: false,
      reserved: ['Kestrel', 'Moth', 'Rook', 'Sable'].includes(name),
      // Kestrel checked Sable's Steam account earlier and found nothing to act on. Checks made in ?demo are kept in the
      // page (see demoCall).
      checked: demoCheckOf(name, now),
    };
  }).map((p) => (demoChecks.has(p.steamId) ? { ...p, checked: demoChecks.get(p.steamId) } : p));
  // Joins and leaves, newest first. Each leave says how long they were on. Moss was on when the bot started keeping the
  // log, so their time on is not known; Nightjar left while the bot could not read the server.
  const visitor = (name, i) => ({ steamId: `7656119800002${String(i).padStart(4, '0')}`, name });
  const player = (name) => {
    const p = inGame.find((q) => q.name === name);
    return p === undefined ? ref(name) : { steamId: p.steamId, name: p.name, ...(p.id ? { id: p.id } : {}) };
  };
  const join = (minutes, kind, who, onFor = null, from = null) => ({
    at: ago(minutes),
    kind,
    player: typeof who === 'string' ? player(who) : who,
    from: from === null ? null : ago(from),
    minutes: kind === 'left' ? onFor : null,
  });
  const joins = [
    join(2, 'joined', 'Zed'),
    join(5, 'left', visitor('Drifter', 1), 37),
    join(9, 'joined', 'Ghost_7'),
    join(14, 'joined', 'Wren'),
    join(25, 'left', 'Bravo_Six', 48),
    join(31, 'left', visitor('Moss', 2)),
    join(42, 'joined', visitor('Drifter', 1)),
    join(73, 'joined', 'Bravo_Six'),
    join(140, 'left', 'Nightjar', 54, 171),
    join(225, 'joined', 'Nightjar'),
  ];
  const sum = (key) => players.reduce((n, p) => n + p[key], 0);
  return {
    generatedAt: now,
    days,
    joins,
    feedSince: new Date(now - 40 * DAY).toISOString().slice(0, 10),
    flags: { teamKills: 3, sameTeammate: 2, vehicleSuicides: 2, suicides: 10 },
    totals: {
      teamKills: sum('teamKills'),
      vehicleTeamKills: sum('vehicleTeamKills'),
      crashTeamKills: sum('crashTeamKills'),
      suicides: sum('suicides'),
      vehicleSuicides: sum('vehicleSuicides'),
      flaggedPlayers: flagged.length,
    },
    players,
    incidents,
    moderation,
    bans,
    // Who the staff are, by Discord user ID.
    staff: {
      '100000000000000001': { name: 'Sarge', username: 'sarge_gi' },
      '100000000000000002': { name: 'Kestrel', username: 'kestrel' },
    },
    user: { id: '100000000000000001', name: 'Sarge' },
    // Staff who linked their Steam account. Sarge has not, so the page asks.
    staffProfiles: [{ userId: '100000000000000002', name: 'Kestrel', linkedAt: now - 9 * DAY, player: ref('Kestrel'), seen: true }],
    dealt: demoDealtBook(now),
    reserved: {
      players: [
        { player: ref('Kestrel'), bot: null, staff: { since: now - 9 * DAY } },
        { player: ref('Moth'), bot: { since: now - 6 * DAY, until: now + DAY }, staff: null },
        { player: ref('Rook'), bot: null, staff: null },
        { player: ref('Sable'), bot: null, staff: null },
      ],
      maxSlots: 2,
    },
    server: {
      name: 'gaminginit #1 | UK | Seed for VIP',
      players: inGame.length,
      maxPlayers: CAPACITY,
      map: 'Ozeti',
      phase: 'live',
      factionScores: [
        { name: 'Valkyra', score: 61, colorHex: SIDE_COLOURS.Valkyra },
        { name: 'Manticore', score: 54, colorHex: SIDE_COLOURS.Manticore },
      ],
      seenAt: now - 20_000,
    },
    online: { at: now - 20_000, map: 'Ozeti', players: inGame },
    steam: {
      flags: { vacBan: 3, gameBan: 3, recentBan: 1, communityBan: 2, tradeBan: 1, newAccount: 3, youngAccount: 1, hidden: 1 },
      marks: { recentBanDays: 365, newAccountDays: 30, youngAccountDays: 180 },
      risk: { alert: 7, high: 4, medium: 2 },
      players: 14 * scale,
      checked: 14 * scale - 1,
      high: 2,
      medium: 1,
      accounts: [
        account(ref('Pike'), now, {
          risk: 'high',
          score: 5,
          flags: ['vacBan', 'recentBan', 'hidden'],
          vacBans: 1,
          lastBanAt: now - 41 * DAY,
          public: false,
          createdAt: null,
          inGame: true,
          feedKills: 34 * scale,
          headshots: 23 * scale,
        }),
        account(ref('Bravo_Six'), now, {
          risk: 'high',
          score: 4,
          flags: ['newAccount', 'hidden'],
          setUp: false,
          createdAt: now - 6 * DAY,
          banned: true,
          matches: 1,
          kills: 31,
          deaths: 4,
          minutes: 48,
          feedKills: 29,
          headshots: 17,
        }),
        account(ref('Sable'), now, {
          risk: 'medium',
          score: 3,
          flags: ['gameBan'],
          gameBans: 2,
          lastBanAt: now - 3 * 365 * DAY,
          createdAt: now - 9 * 365 * DAY,
          inGame: true,
        }),
      ],
    },
  };
};

// A risky account in the sample staff page, as the bot sends it, checked 3 hours before `now`.
const account = (player, now, t) => ({
  ...player,
  vacBans: 0,
  gameBans: 0,
  lastBanAt: null,
  communityBanned: false,
  tradeBan: 'none',
  public: true,
  setUp: true,
  createdAt: null,
  checkedAt: now - 3 * HOUR,
  inGame: false,
  banned: false,
  matches: 4,
  kills: 52,
  deaths: 30,
  minutes: 190,
  feedKills: 48,
  headshots: 9,
  ...t,
});

// The staff page's Kills tab (GET /api/admin/kills), with the same made-up Steam IDs as demoAdmin. Ghost_7, new today,
// and Pike, with a high-risk Steam account, get far more headshots than their weapons do; Sable's are ordinary for a
// sniper rifle. Bravo_Six, banned for cheating, is not in game.
const demoSteamId = (name) => (name === 'Ghost_7' ? '76561198000010008' : `7656119800000${String(NAMES.indexOf(name)).padStart(4, '0')}`);

// name, kills and headshots a day, the headshots their weapons usually get a day, the chance over a day, days flagged
// of the last 7, and their weapons: name, kind, share of their kills, their share of headshots with it, and the
// server's.
const KILLERS = [
  ['Ghost_7', 28, 21, 7.4, 2e-9, 1, [['AK74', 'weapon', 0.9, 0.84, 0.27], ['M67 frag grenade', 'weapon', 0.1, 0, 0]]],
  ['Pike', 34, 23, 9.6, 4e-7, 3, [['M4', 'weapon', 0.85, 0.8, 0.31], ['MGL-40', 'weapon', 0.15, 0, 0.02]]],
  ['Bravo_Six', 29, 22, 8.1, 1e-8, 1, [['AK74', 'weapon', 1, 0.76, 0.27]]],
  ['Rook', 30, 13, 8.2, 0.02, 0, [['M4', 'weapon', 0.8, 0.54, 0.31], ['RPG-7', 'weapon', 0.2, 0, 0.02]]],
  ['Sable', 40, 22, 19.5, 0.3, 0, [['SVD', 'weapon', 0.75, 0.62, 0.55], ['GGX 17', 'weapon', 0.25, 0.3, 0.3]]],
  ['Kestrel', 52, 16, 14.2, 0.3, 0, [['AK74', 'weapon', 0.7, 0.33, 0.27], ['Humvee minigun', 'vehicle-weapon', 0.3, 0.05, 0.05]]],
  ['Moth', 26, 7, 6.9, 0.5, 0, [['PKM', 'weapon', 0.8, 0.27, 0.27], ['WEPN 099', 'weapon', 0.2, 0.3, 0.3]]],
  ['Tusk', 18, 4, 4.4, 0.6, 0, [['M249 SAW', 'weapon', 1, 0.22, 0.24]]],
  ['Vex', 22, 3, 3.1, 0.6, 0, [['Humvee', 'vehicle', 0.5, 0, 0], ['AK74', 'weapon', 0.5, 0.27, 0.27]]],
  ['Ash', 15, 4, 3.9, 0.5, 0, [['M4', 'weapon', 0.8, 0.27, 0.31], ['SMG 99', 'weapon', 0.2, 0.16, 0.16]]],
  ['Nightjar', 24, 6, 6.3, 0.4, 0, [['AK74', 'weapon', 1, 0.25, 0.27]]],
];

// The weapons in the sample the bot has no name for, so it sends the game's code for them.
const UNNAMED = ['WEPN 099', 'SMG 99'];

// Bravo_Six and Nightjar are the sample's players not in game; Ghost_7 only played today.
const OFFLINE = ['Bravo_Six', 'Nightjar'];
const killerDays = (name, days) => (name === 'Ghost_7' ? 1 : name === 'Bravo_Six' ? Math.min(days, 2) : days);

// Those flagged in game were flagged today, and those not in game yesterday.
const killerRow = ([name, kills, headshots, expected, odds, flagged, weapons], days, now) => {
  const played = killerDays(name, days);
  return {
    steamId: demoSteamId(name),
    name,
    kills: kills * played,
    headshots: headshots * played,
    expected: Math.round(expected * played * 10) / 10,
    // A flagged player's days add up to something ever less likely.
    chance: flagged > 0 ? odds ** played : odds,
    days: played,
    flaggedDays: Math.min(flagged, played),
    lastFlaggedDay: flagged > 0 ? demoDay(OFFLINE.includes(name) ? now - DAY : now) : null,
    weapon: weapons[0][0],
    inGame: !OFFLINE.includes(name),
  };
};

const VICTIMS = ['Hex', 'Juno', 'Kodiak', 'Lynx', 'Mako', 'Nova', 'Orca', 'Quill', 'Raven', 'Saber'];
// As demoAdmin has them in game.
const victimRef = (i) => ({ steamId: `7656119800001${String(10 + (i % VICTIMS.length)).padStart(4, '0')}`, name: VICTIMS[i % VICTIMS.length] });
const KILL_TAGS = [[], [], [], ['Penetration'], [], ['Ricochet'], []];

// The `n`th kill by a sample killer, `at` then: whom, with what, and a headshot as often as theirs are.
const demoKill = (killer, n, at) => {
  const [name, , , , , , weapons] = killer;
  const pick = chance(n, name.length);
  let share = 0;
  const weapon = weapons.find(([, , kills]) => (share += kills) >= pick) ?? weapons[0];
  const [weaponName, kind, , headshots] = weapon;
  const near = kind === 'vehicle' ? null : Math.round((8 + chance(n, 3) * (weaponName === 'SVD' ? 600 : 160)) * 10) / 10;
  return {
    at,
    map: 'Ozeti',
    victim: victimRef(n + name.length),
    weapon: weaponName,
    weaponKind: kind,
    weaponNamed: !UNNAMED.includes(weaponName),
    distance: near,
    headshot: chance(n, 7) < headshots,
    tags: kind === 'vehicle' ? ['RoadKill'] : KILL_TAGS[n % KILL_TAGS.length],
    teamKill: name === 'Vex' && n % 9 === 0,
  };
};

export const demoKills = (days, now) => {
  const rows = KILLERS.map((k) => killerRow(k, days, now)).sort(
    (a, b) => b.flaggedDays - a.flaggedDays || a.chance - b.chance || b.headshots - a.headshots,
  );
  const inGame = KILLERS.filter(([name]) => !OFFLINE.includes(name));
  const feed = Array.from({ length: 60 }, (_, i) => {
    const killer = inGame[Math.floor(chance(i, 11) * inGame.length)];
    return { ...demoKill(killer, i, now - 20_000 - i * 23_000), killer: { steamId: demoSteamId(killer[0]), name: killer[0] } };
  });
  const kills = rows.reduce((n, r) => n + r.kills, 0) + 180 * days;
  const headshots = rows.reduce((n, r) => n + r.headshots, 0) + 41 * days;
  return {
    generatedAt: now,
    days,
    since: new Date(now - 12 * DAY).toISOString().slice(0, 10),
    flag: { kills: 10, odds: 1000 },
    totals: { kills, headshots, players: 14 * Math.min(days, 3) + 10, flaggedPlayers: rows.filter((r) => r.flaggedDays > 0).length },
    players: [...rows.filter((r) => r.inGame), ...rows.filter((r) => !r.inGame)],
    feed,
    unnamedWeapons: [
      ['WEPN 099', 78, 341, 7, ['Moth', 'Sable', 'Bravo_Six']],
      ['SMG 99', 51, 74, 12, ['Ash', 'Kestrel', 'Rook', 'Vex', 'Nightjar']],
    ].map(([name, kills, longest, users, by]) => ({
      name,
      kind: 'weapon',
      kills,
      longest,
      lastDay: new Date(now).toISOString().slice(0, 10),
      users,
      players: by.map((who, i) => ({ steamId: demoSteamId(who), name: who, kills: Math.round(kills / (i + 2)), inGame: !OFFLINE.includes(who) })),
    })),
  };
};

// A kill as the live kill feed sends it, the `n`th since the page opened, by someone in game.
export const demoFeedKill = (n, now) => {
  const inGame = KILLERS.filter(([name]) => !OFFLINE.includes(name));
  const killer = inGame[Math.floor(chance(n, 13) * inGame.length)];
  return { ...demoKill(killer, 1000 + n, now), killer: { steamId: demoSteamId(killer[0]), name: killer[0] } };
};

// A sample player's name by Steam ID, or the Steam ID for someone not in the sample.
const demoNameOf = (steamId) =>
  KILLERS.find(([name]) => demoSteamId(name) === steamId)?.[0] ??
  NAMES.find((n) => demoSteamId(n) === steamId) ??
  VICTIMS.find((_, i) => victimRef(i).steamId === steamId) ??
  steamId;

// A sample player's team kills today, as their record has them: the same as the Queue's sample for Vex and Tusk.
const demoGrief = (name, now) => {
  const at = (minutes) => now - minutes * MINUTE;
  const ref = (n) => ({ steamId: demoSteamId(n), name: n });
  const incident = (minutes, kind, victim, weapon, distance, map) => ({
    at: at(minutes),
    kind,
    map,
    player: ref(name),
    victim: victim === null ? null : ref(victim),
    faction: null,
    weapon,
    weaponKind: null,
    distance,
    tags: [],
  });
  const none = { teamKills: 0, vehicleTeamKills: 0, crashTeamKills: 0, teamKilled: 0, suicides: 0, vehicleSuicides: 0, flags: [], victims: [], incidents: [] };
  if (name === 'Vex') {
    return {
      ...none,
      teamKills: 7,
      vehicleTeamKills: 4,
      crashTeamKills: 2,
      suicides: 3,
      vehicleSuicides: 2,
      flags: ['teamKills', 'sameTeammate', 'vehicleSuicides'],
      victims: [{ ...ref('Moth'), kills: 2 }, { ...ref('Rook'), kills: 1 }, { ...ref('Sable'), kills: 1 }, { ...ref('Pike'), kills: 1 }],
      incidents: [
        incident(6, 'team-kill', 'Moth', 'Humvee', 4, 'Ozeti'),
        incident(9, 'vehicle-suicide', null, 'MH-6', null, 'Ozeti'),
        incident(11, 'team-kill', 'Rook', 'MH-6', null, 'Ozeti'),
        incident(11, 'team-kill', 'Moth', 'MH-6', null, 'Ozeti'),
        incident(58, 'vehicle-suicide', null, 'Humvee', null, 'Bakurani'),
      ],
    };
  }
  if (name === 'Tusk') {
    return {
      ...none,
      teamKills: 3,
      teamKilled: 1,
      suicides: 12,
      flags: ['teamKills', 'suicides'],
      victims: [{ ...ref('Pike'), kills: 1 }, { ...ref('Rook'), kills: 1 }, { ...ref('Sable'), kills: 1 }],
      incidents: [
        incident(24, 'team-kill', 'Sable', 'M67 frag grenade', 7, 'Ozeti'),
        incident(31, 'team-kill', 'Pike', 'AK74', 18, 'Ozeti'),
        incident(96, 'team-kill', 'Rook', 'M249 SAW', 42, 'Bakurani'),
      ],
    };
  }
  return none;
};

// A sample player's record, as GET /api/admin/player sends it.
export const demoPlayerRecord = (steamId, now) => {
  const name = demoNameOf(steamId);
  const inGame = !OFFLINE.includes(name) && (KILLERS.some(([n]) => n === name) || VICTIMS.includes(name));
  const banned = name === 'Bravo_Six' || name === 'Nightjar';
  const sarge = { by: '100000000000000001', byName: 'Sarge' };
  return {
    steamId,
    name,
    inGame: inGame ? { faction: null, kills: 12, deaths: 7 } : null,
    privateProfile: false,
    days: 90,
    totals: { minutes: 2480, seedingMinutes: 365, seedDays: 9, matches: 58, kills: 1204, deaths: 743 },
    grief: demoGrief(name, now),
    steam:
      name === 'Pike'
        ? { status: 'found', risk: 'high', score: 5, flags: ['vacBan', 'recentBan', 'hidden'], facts: ['1 VAC ban, 41 days ago', 'Account age hidden', 'Private profile'], checkedAt: now - 2 * HOUR }
        : { status: 'found', risk: 'low', score: 0, flags: [], facts: ['No VAC or game bans', 'Account made 6 years ago', 'Public profile'], checkedAt: now - 5 * HOUR },
    vip: name === 'Moth' ? { kind: 'bot', until: now + DAY, checked: true, blockedUntil: null } : { kind: 'none', checked: true, blockedUntil: null },
    ban: banned ? { kind: 'bot', reason: 'Cheating', ...sarge, at: now - 200 * MINUTE, until: null, waiting: name === 'Bravo_Six', checked: true } : { kind: 'none', checked: true },
    log:
      name === 'Vex'
        ? [
            { action: 'warn', at: now - 4 * MINUTE, ...sarge, reason: 'Stop team killing with vehicles' },
            { action: 'kick', at: now - 2 * DAY, ...sarge, reason: 'Crashed a full heli into the base' },
          ]
        : banned
          ? [{ action: 'ban', at: now - 200 * MINUTE, ...sarge, reason: 'Cheating', detail: 'Permanent' }]
          : [],
  };
};

// One sample player's kills, as GET /api/admin/kills?player= sends them: everyone in the sample has some.
export const demoPlayerKills = (steamId, days, now) => {
  const killer = KILLERS.find(([name]) => demoSteamId(name) === steamId);
  const row = killer === undefined ? null : killerRow(killer, days, now);
  const name = demoNameOf(steamId);
  const today = Math.floor(now / DAY) * DAY;
  const byDay = Array.from({ length: row?.days ?? 0 }, (_, i) => {
    const flagged = i < (row?.flaggedDays ?? 0);
    const [, kills, headshots, expected, odds] = killer;
    return {
      day: new Date(today - i * DAY).toISOString().slice(0, 10),
      kills: kills + ((i * 3) % 5) - 2,
      // Their other days are ordinary.
      headshots: flagged ? headshots : Math.round(expected * 1.1),
      expected,
      chance: flagged ? odds : 0.3,
      flagged,
    };
  });
  // Today's kills, a few a minute this evening, and some on each earlier day.
  const list = byDay.flatMap((d, i) =>
    Array.from({ length: Math.min(d.kills, i === 0 ? 30 : 12) }, (_, n) => demoKill(killer, i * 50 + n, (i === 0 ? now - 4 * MINUTE : today - (i - 0.85) * DAY) - n * 97_000)),
  );
  const weapons = (killer?.[6] ?? []).map(([weapon, kind, kills, headshots, usual]) => {
    const used = Math.round((row?.kills ?? 0) * kills);
    return { name: weapon, kind, kills: used, headshots: Math.round(used * headshots), expected: Math.round(used * usual * 10) / 10 };
  });
  return {
    generatedAt: now,
    days,
    since: new Date(now - 12 * DAY).toISOString().slice(0, 10),
    flag: { kills: 10, odds: 1000 },
    player: { steamId, name, ...(NAMES.includes(name) ? { id: idOf(name) } : {}), inGame: !OFFLINE.includes(name) },
    kills: row?.kills ?? 0,
    headshots: row?.headshots ?? 0,
    expected: row?.expected ?? null,
    chance: row?.chance ?? null,
    flaggedDays: row?.flaggedDays ?? 0,
    weapons,
    byDay,
    list,
    kept: row?.kills ?? 0,
    sessions: demoSessions(!OFFLINE.includes(name), days, now),
  };
};

// A player's times on the server, newest first: the one they are on now, while in game, then an evening on two days in
// three. The day before yesterday, the bot couldn't read the server when they left; on the oldest, in a longer period,
// they were already on when the log started.
const demoSessions = (inGame, days, now) => {
  const past = Array.from({ length: days }, (_, i) => i)
    .filter((i) => i % 3 !== 1)
    .map((i) => {
      const leftAt = now - i * DAY - 3 * HOUR;
      const minutes = 45 + ((i * 37) % 150);
      const gap = i === 2;
      const unknown = days > 1 && i === days - 1;
      return {
        joinedAt: unknown ? null : leftAt - minutes * MINUTE,
        joinedFrom: null,
        leftAt,
        leftFrom: gap ? leftAt - 25 * MINUTE : null,
        minutes: unknown ? null : gap ? minutes - 25 : minutes,
      };
    });
  const current = { joinedAt: now - 35 * MINUTE, joinedFrom: null, leftAt: null, leftFrom: null, minutes: 35 };
  return inGame ? [current, ...past] : past;
};

// The bot's staff commands, as GET /api/admin/commands sends them, for the admin tools in ?demo. Copied from the bot;
// the real page always gets them from the bot.
export const demoCommands = [
  {"name":"broadcast","description":"Send a message to everyone in game (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"message","description":"What to show in game (up to 200 characters)","required":true,"max_length":200}]},
  {"name":"seeders","description":"Who seeded the most, with Steam IDs for VIP (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":4,"name":"days","description":"How many days to count, including today (default 7)","required":false,"min_value":1,"max_value":90}]},
  {"name":"seednow","description":"Post \"we're seeding now, come join\" to the alerts channel and ping the role (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"message","description":"Anything to add, such as which squad to join","required":false,"max_length":200}]},
  {"name":"removematch","description":"Delete a wrongly recorded match and its leaderboard counts (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"match","description":"Pick the match from the list","required":true,"autocomplete":true}]},
  {"name":"warn","description":"Send a player a private warning in game (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Who to warn: pick from the players in game","required":true,"autocomplete":true},{"type":3,"name":"message","description":"The warning","required":true,"max_length":140}]},
  {"name":"player","description":"A player's Steam ID, playtime, seeding, VIP, bans and staff history (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Pick the player, or type a name or Steam ID","required":true,"autocomplete":true}]},
  {"name":"kick","description":"Remove a player from the server; they can rejoin (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Who to kick: pick from the players in game","required":true,"autocomplete":true},{"type":3,"name":"reason","description":"Why; the player sees this","required":true,"max_length":200}]},
  {"name":"switchteam","description":"Move a player to another team (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Who to move: pick from the players in game","required":true,"autocomplete":true},{"type":3,"name":"team","description":"The team to move them to (with two teams, leave it out for the other one)","required":false,"choices":[{"name":"🔵 Lonestar","value":"Lonestar"},{"name":"🟢 Manticore","value":"Manticore"},{"name":"🔴 Valkyra","value":"Valkyra"}]}]},
  {"name":"ban","description":"Ban a player for a set time or for good (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Pick the player, or type a name or Steam ID","required":true,"autocomplete":true},{"type":3,"name":"duration","description":"How long","required":true,"choices":[{"name":"1 hour","value":"1h"},{"name":"1 day","value":"1d"},{"name":"3 days","value":"3d"},{"name":"7 days","value":"7d"},{"name":"30 days","value":"30d"},{"name":"Permanent","value":"permanent"}]},{"type":3,"name":"reason","description":"Why; kept with the ban","required":true,"max_length":200}]},
  {"name":"unban","description":"Lift a ban (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"steam_id","description":"Pick from the banned players, or type a Steam ID","required":true,"autocomplete":true}]},
  {"name":"setnextmap","description":"Set the map and setup after this match, without changing the rotation (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"map","description":"Pick the map from the list","required":true,"autocomplete":true},{"type":3,"name":"mode","description":"Game mode (default: as in the rotation)","required":false,"autocomplete":true},{"type":5,"name":"infantry_only","description":"Infantry only (default: as in the rotation)","required":false},{"type":5,"name":"hardcore","description":"Hardcore (default: as in the rotation)","required":false},{"type":3,"name":"lighting","description":"Time of day and weather (default: as in the rotation)","required":false,"autocomplete":true},{"type":3,"name":"zones","description":"Control zone layout (default: as in the rotation)","required":false,"autocomplete":true}]},
  {"name":"changemap","description":"End the current match now and change map and setup (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"map","description":"Pick the map from the list","required":true,"autocomplete":true},{"type":3,"name":"mode","description":"Game mode (default: as in the rotation)","required":false,"autocomplete":true},{"type":5,"name":"infantry_only","description":"Infantry only (default: as in the rotation)","required":false},{"type":5,"name":"hardcore","description":"Hardcore (default: as in the rotation)","required":false},{"type":3,"name":"lighting","description":"Time of day and weather (default: as in the rotation)","required":false,"autocomplete":true},{"type":3,"name":"zones","description":"Control zone layout (default: as in the rotation)","required":false,"autocomplete":true}]},
  {"name":"vip","description":"Give or take away a whitelist slot (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":1,"name":"add","description":"Give a player a whitelist slot for a number of days, or permanently","options":[{"type":3,"name":"steam_id","description":"Pick the player, or type a name or Steam ID","required":true,"autocomplete":true},{"type":3,"name":"reason","description":"Why they get VIP; posted to the moderation log","required":true,"choices":[{"name":"Friend","value":"friend"},{"name":"Regular","value":"regular"},{"name":"Seeder","value":"seeder"},{"name":"Paid","value":"paid"},{"name":"Other","value":"other"}]},{"type":4,"name":"days","description":"How many days (leave out when permanent)","required":false,"min_value":1,"max_value":365},{"type":5,"name":"permanent","description":"No end date, until staff remove it (default: off)","required":false},{"type":3,"name":"note","description":"More about why (needed for Other)","required":false,"max_length":200}]},{"type":1,"name":"remove","description":"Take a player off the whitelist; automatic VIP skips them for 7 days","options":[{"type":3,"name":"steam_id","description":"Pick from the whitelist, or type a Steam ID","required":true,"autocomplete":true},{"type":3,"name":"reason","description":"Why; posted to the moderation log","required":false,"max_length":200}]}]},
  {"name":"rotations","description":"Saved map rotations, and which one the server plays each day (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":1,"name":"show","description":"The saved rotations and the week, or the maps in one rotation","options":[{"type":3,"name":"rotation","description":"Pick a rotation to see its maps (default: all of them, and the week)","required":false,"autocomplete":true,"max_length":32}]},{"type":1,"name":"use","description":"Put a rotation on the server now, until the next day starts; it plays from the next map","options":[{"type":3,"name":"rotation","description":"Pick the rotation","required":true,"autocomplete":true,"max_length":32}]},{"type":1,"name":"schedule","description":"Pick the rotation for a day of the week; it goes on the server each week as that day starts","options":[{"type":3,"name":"day","description":"Which day","required":true,"choices":[{"name":"Monday","value":"monday"},{"name":"Tuesday","value":"tuesday"},{"name":"Wednesday","value":"wednesday"},{"name":"Thursday","value":"thursday"},{"name":"Friday","value":"friday"},{"name":"Saturday","value":"saturday"},{"name":"Sunday","value":"sunday"},{"name":"Weekdays (Monday to Friday)","value":"weekdays"},{"name":"Weekend (Saturday and Sunday)","value":"weekend"},{"name":"Every day","value":"every-day"}]},{"type":3,"name":"rotation","description":"The rotation for that day (leave out to keep whatever the server has)","required":false,"autocomplete":true,"max_length":32}]},{"type":1,"name":"add","description":"Add a map to a rotation; a new name starts a new rotation","options":[{"type":3,"name":"rotation","description":"The rotation to add to, or a new name such as \"Rotation 1\"","required":true,"autocomplete":true,"max_length":32},{"type":3,"name":"map","description":"Pick the map from the list","required":true,"autocomplete":true},{"type":3,"name":"mode","description":"Game mode (default: the map's first)","required":false,"autocomplete":true},{"type":5,"name":"infantry_only","description":"Infantry only (default: off)","required":false},{"type":5,"name":"hardcore","description":"Hardcore (default: off)","required":false},{"type":3,"name":"lighting","description":"Time of day and weather (default: the map's own)","required":false,"autocomplete":true},{"type":3,"name":"zones","description":"Control zone layout (default: the map's own)","required":false,"autocomplete":true},{"type":4,"name":"position","description":"Where in the list, 1 for first (default: at the end)","required":false,"min_value":1,"max_value":100}]},{"type":1,"name":"remove","description":"Take a map out of a rotation","options":[{"type":3,"name":"rotation","description":"Pick the rotation","required":true,"autocomplete":true,"max_length":32},{"type":3,"name":"map","description":"Pick the map to take out","required":true,"autocomplete":true}]},{"type":1,"name":"save","description":"Save the server's rotation as it is now under a name (replaces a rotation with that name)","options":[{"type":3,"name":"rotation","description":"A name for it, such as \"Rotation 1\"","required":true,"autocomplete":true,"max_length":32}]},{"type":1,"name":"delete","description":"Delete a saved rotation (the server keeps the maps it has)","options":[{"type":3,"name":"rotation","description":"Pick the rotation","required":true,"autocomplete":true,"max_length":32}]}]},
  {"name":"private","description":"Private profiles: hidden by name on the website and in public Discord posts (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":1,"name":"add","description":"Make a player's profile private: shown as [private profile], with no player page","options":[{"type":3,"name":"steam_id","description":"Pick the player, or type a name or Steam ID","required":true,"autocomplete":true}]},{"type":1,"name":"remove","description":"Make a player's profile public again","options":[{"type":3,"name":"steam_id","description":"Pick from the private profiles, or type a Steam ID","required":true,"autocomplete":true}]},{"type":1,"name":"list","description":"Who has a private profile"}]},
];

const DEMO_MAPS = [
  { name: '🟧 Bakurani', value: 'Kavkazi' },
  { name: '🟦 Ozeti', value: 'Europe' },
  { name: '🟪 Zestafona', value: 'Zestafona' },
];

const DEMO_ROTATIONS = [
  { name: 'Rotation 1 · 6 maps', value: 'Rotation 1' },
  { name: 'Weekend · 4 maps', value: 'Weekend' },
];

// A UTC day, as the bot names them: '2026-10-16'.
const demoDay = (at) => new Date(at).toISOString().slice(0, 10);

// "Dealt with" on the Queue in ?demo, by Steam ID (null for one undone), kept until the page is closed. Kestrel dealt with
// Bravo_Six, who has left, this morning, and with Tusk two days ago, who has been flagged again since.
const demoDealt = new Map();
const demoDealtBook = (now) => {
  const kestrel = { by: '100000000000000002', byName: 'Kestrel' };
  const book = {
    [demoSteamId('Bravo_Six')]: { ...kestrel, at: now - 5 * HOUR, reasons: ['headshots', 'steam'], headshotDay: demoDay(now - DAY), griefDay: null, steamScore: 4 },
    [demoSteamId('Tusk')]: { ...kestrel, at: now - 2 * DAY, reasons: ['griefing'], headshotDay: null, griefDay: demoDay(now - 3 * DAY), steamScore: null },
  };
  for (const [steamId, dealt] of demoDealt) {
    if (dealt === null) delete book[steamId];
    else book[steamId] = dealt;
  }
  return book;
};

// What the bot answers the admin tools in ?demo: sample players and maps to pick from, and nothing done.
// "Checked, they're fine" in ?demo, by Steam ID (null for one taken back), kept until the page is closed.
const demoChecks = new Map();
const demoCheckOf = (name, now) =>
  name === 'Sable' ? { by: '100000000000000002', byName: 'Kestrel', at: now - 22 * 60_000, reasons: ['steam'], teamKills: 0, vehicleSuicides: 0 } : null;

export const demoCall = async (path, body) => {
  // Linking or unlinking a Steam account: nothing is saved.
  if (path === 'admin/profile') return { ok: true, json: { steamId: body.action === 'link' ? body.steamId : null, player: null, sample: true } };
  // A check, as the bot keeps it, by the signed-in sample staff member.
  if (path === 'admin/check') {
    const checked =
      body.action === 'check'
        ? { by: '100000000000000001', byName: 'Sarge', at: Date.now(), reasons: body.reasons, teamKills: body.teamKills, vehicleSuicides: body.vehicleSuicides }
        : null;
    demoChecks.set(body.steamId, checked);
    return { ok: true, json: { checked } };
  }
  // A dealt with, as the bot keeps it, by the signed-in sample staff member.
  if (path === 'admin/dealt') {
    const { action: _action, steamId, ...shown } = body;
    const dealt = body.action === 'deal' ? { by: '100000000000000001', byName: 'Sarge', at: Date.now(), ...shown } : null;
    demoDealt.set(steamId, dealt);
    return { ok: true, json: { dealt } };
  }
  const { name, options, focused } = body;
  if (path === 'admin/suggest') {
    const typed = (options[focused] ?? '').toLowerCase();
    const choices =
      focused === 'player' || focused === 'steam_id'
        ? NAMES.map((n, i) => ({ name: `${n} · ${i % 2 ? '🟢 Manticore' : '🔴 Valkyra'} · 7656119800000${String(i).padStart(4, '0')}`, value: `7656119800000${String(i).padStart(4, '0')}` }))
        : focused === 'map'
          ? DEMO_MAPS
          : focused === 'rotation'
            ? DEMO_ROTATIONS
            : [];
    return { ok: true, json: { choices: choices.filter((c) => c.name.toLowerCase().includes(typed) || c.value.includes(typed)) } };
  }
  const sub = options.subcommand ? ` ${options.subcommand}` : '';
  return { ok: true, json: { content: `Sample only: nothing was done. Signed in, this runs **/${name}${sub}** on the bot, as you.` } };
};

// The Rotations tab in ?demo (GET and POST /api/admin/rotations): sample rotations kept in this page only, changed the
// way the bot changes them, so every button can be tried. Nothing reaches a server.
const KOTH = (map) => `${map}_KOTH_01`;
const DEMO_LIGHTINGS = [
  ['DayStartClear', 'Dawn, clear'],
  ['DayEarlyClear', 'Morning, clear'],
  ['DayEarlyFog', 'Morning fog'],
  ['DayClear', 'Day, clear'],
  ['DayLateClear', 'Afternoon, clear'],
  ['DayLateGray', 'Afternoon, overcast'],
  ['DayLateGrayFog', 'Afternoon fog'],
  // Season 2 (15 October 2026).
  ['DayLateRain', 'Afternoon, rain'],
  ['DayEndClear', 'Dusk, clear'],
].map(([id, name]) => ({ id, name }));

const demoMap = (id, name, zones) => ({
  id,
  name,
  modes: [
    { id: KOTH(id), name: 'King of the Hill' },
    { id: `${id}_KOTH_02`, name: 'King of the Hill (small)' },
  ],
  modifiers: [
    { key: 'infantry_only', name: 'Infantry only', id: 'KOTH_InfantryOnly' },
    { key: 'hardcore', name: 'Hardcore', id: 'KOTH_Hardcore' },
  ],
  zones: zones.map((z) => ({ id: `ZoneAlternator.${name}.Default.${z}`, name: z })),
});

const DEMO_CATALOG = {
  maps: [demoMap('Kavkazi', 'Bakurani', ['Circle', 'Line', 'Factory']), demoMap('Europe', 'Ozeti', ['Circle', 'Village']), demoMap('NorthAmerica', 'Zestafona', ['Circle', 'Ridge'])],
  lightings: DEMO_LIGHTINGS,
  experiences: [],
};

const entry = (map, { mode = KOTH(map), modifiers = [], lighting, zone } = {}) => ({
  map,
  experiences: [mode, ...modifiers],
  ...(lighting ? { lighting } : {}),
  ...(zone ? { zoneAlternator: zone } : {}),
});

const demoRotationState = {
  rotations: [
    {
      name: 'Default',
      entries: [
        entry('Kavkazi', { lighting: 'DayClear' }),
        entry('Europe'),
        entry('NorthAmerica', { lighting: 'DayLateClear' }),
        entry('Kavkazi', { lighting: 'DayEndClear', zone: 'ZoneAlternator.Bakurani.Default.Line' }),
        entry('Europe', { lighting: 'DayEarlyFog' }),
        entry('NorthAmerica'),
      ],
    },
    {
      name: 'Weekend',
      entries: [
        entry('Europe', { modifiers: ['KOTH_InfantryOnly'], lighting: 'DayEndClear' }),
        entry('Kavkazi', { modifiers: ['KOTH_Hardcore'] }),
        entry('NorthAmerica', { mode: 'NorthAmerica_KOTH_02', lighting: 'DayLateGrayFog' }),
        entry('Kavkazi', { modifiers: ['KOTH_InfantryOnly'], lighting: 'DayStartClear', zone: 'ZoneAlternator.Bakurani.Default.Factory' }),
      ],
    },
    {
      name: 'Infantry night',
      entries: [
        entry('Europe', { modifiers: ['KOTH_InfantryOnly'], lighting: 'DayEndClear' }),
        entry('Kavkazi', { modifiers: ['KOTH_InfantryOnly'], lighting: 'DayEndClear' }),
        entry('NorthAmerica', { modifiers: ['KOTH_InfantryOnly'], lighting: 'DayEndClear' }),
      ],
    },
  ],
  week: [null, null, null, null, 'Infantry night', 'Weekend', 'Weekend'],
  applied: null,
};

const DEMO_HOUR = 5;
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const demoToday = () => {
  const shifted = new Date(Date.now() - DEMO_HOUR * 60 * MINUTE);
  return { day: shifted.toISOString().slice(0, 10), weekday: (shifted.getUTCDay() + 6) % 7 };
};

const findDemo = (name) => demoRotationState.rotations.find((r) => r.name.toLowerCase() === String(name ?? '').trim().toLowerCase()) ?? null;
const demoPlan = (weekday) => {
  const own = findDemo(demoRotationState.week[weekday]);
  return own && own.entries.length > 0 ? own.name : 'Default';
};

const demoRotationsPage = () => {
  const today = demoToday();
  if (demoRotationState.applied?.day !== today.day) {
    demoRotationState.applied = { name: demoPlan(today.weekday), day: today.day, at: Date.now(), by: 'schedule', pending: false };
  }
  const playing = findDemo(demoRotationState.applied.name) ?? demoRotationState.rotations[0];
  return {
    defaultName: 'Default',
    hour: DEMO_HOUR,
    limits: { rotations: 10, maps: 100, name: 32 },
    today,
    weekdays: WEEKDAY_NAMES,
    rotations: structuredClone(demoRotationState.rotations),
    week: [...demoRotationState.week],
    plan: WEEKDAY_NAMES.map((_, i) => demoPlan(i)),
    current: { ...demoRotationState.applied },
    server: { enabled: true, mode: 'ordered', entries: playing.entries.map((e, i) => ({ ...e, status: i === 1 ? 'now' : i === 2 ? 'next' : null })) },
    catalog: DEMO_CATALOG,
  };
};

export const demoRotations = async () => ({ ok: true, status: 200, json: demoRotationsPage() });

// A change, as the bot makes it: refused with a reason, or the page as it is after it.
export const demoRotationsChange = async (body) => {
  const refuse = (error) => ({ ok: false, json: { error } });
  const state = demoRotationState;
  const today = demoToday();
  demoRotationsPage();
  const choose = (name) => {
    state.applied = { name, day: today.day, at: Date.now(), by: 'demo', byName: 'Sarge', pending: false };
    return { outcome: 'updated' };
  };
  let outcome = null;
  if (body.action === 'save') {
    const name = body.name.trim().replace(/\s+/g, ' ');
    const from = body.from ? findDemo(body.from) : null;
    if (body.from && !from) return refuse(`There's no rotation called "${body.from}".`);
    if (from?.name === 'Default' && name !== 'Default') return refuse('**Default** keeps its name.');
    const clash = findDemo(name);
    if (from && clash && clash !== from) return refuse(`There's already a rotation called **${clash.name}**.`);
    if (body.entries.length === 0) return refuse('A rotation needs at least one map.');
    const target = from ?? clash;
    if (!target && state.rotations.filter((r) => r.name !== 'Default').length >= 10) return refuse('There are already 10 rotations. Delete one first.');
    if (target) {
      const old = target.name;
      target.name = name;
      target.entries = structuredClone(body.entries);
      state.week = state.week.map((n) => (n && n.toLowerCase() === old.toLowerCase() ? name : n));
      if (state.applied.name.toLowerCase() === old.toLowerCase()) {
        state.applied.name = name;
        outcome = { outcome: 'updated' };
      }
    } else state.rotations.push({ name, entries: structuredClone(body.entries) });
  } else if (body.action === 'use') {
    if (!findDemo(body.name)) return refuse(`There's no rotation called "${body.name}".`);
    outcome = choose(findDemo(body.name).name);
  } else if (body.action === 'schedule') {
    const rotation = body.name ? findDemo(body.name) : null;
    for (const d of body.days) state.week[d] = rotation && rotation.name !== 'Default' ? rotation.name : null;
    if (body.days.includes(today.weekday)) outcome = choose(demoPlan(today.weekday));
  } else if (body.action === 'delete') {
    const rotation = findDemo(body.name);
    if (!rotation) return refuse(`There's no rotation called "${body.name}".`);
    if (rotation.name === 'Default') return refuse("**Default** can't be deleted.");
    state.rotations = state.rotations.filter((r) => r !== rotation);
    state.week = state.week.map((n) => (n === rotation.name ? null : n));
    if (state.applied.name === rotation.name) outcome = choose('Default');
  }
  return { ok: true, json: { ...demoRotationsPage(), ...(outcome ? { outcome } : {}) } };
};

// The staff page's Lines tab, as the bot sends it: each list with what the bot puts around its lines and fills in,
// for gaminginit.com with seeder VIP on, 20 players to go live and 100 points to win.
const DEMO_SITE = 'gaminginit.com';
const DEMO_HALFWAY_AFTER = ` Check the leaderboard and stats at ${DEMO_SITE}`;
const DEMO_NEARLY_AFTER = ` Where do you rank? Leaderboard and stats at ${DEMO_SITE}`;
const demoList = (id, group, name, note, frame, lines) => ({ id, group, name, note, off: null, ...frame, lines, changed: null });
const demoFaction = (group, key, name, note, frame, lines) => demoList(`${group === 'Halfway' ? 'halfway' : 'nearly'}.${key}`, group, name, note, frame, lines);
const DEMO_TEAM_LONGEST = 'x'.repeat(16);
const halfwayFrame = (team) => ({
  values: { team, score: '50' },
  longest: { team: DEMO_TEAM_LONGEST, score: '100' },
  before: 'Halfway there! ',
  after: DEMO_HALFWAY_AFTER,
});
const nearlyFrame = (team) => ({ values: { team, score: '90' }, longest: { team: DEMO_TEAM_LONGEST, score: '90' }, before: '', after: DEMO_NEARLY_AFTER });
const exactFrame = (values, before, after) => ({ values, longest: values, before, after });

const DEMO_LISTS = [
  demoList(
    'seeding',
    'Seeding',
    'Seeding',
    'Every few minutes while the server seeds, and 30 seconds after someone joins. What seeding earns goes after it.',
    exactFrame({ needed: '19 more players' }, '', ` Seed for over 10 min on 3 days in a week and get a whitelist slot. How at ${DEMO_SITE}`),
    ["We're seeding! {needed} and we go live.", 'Seeding now: {needed} to go live. Stick around and bring a friend.', "Quiet, isn't it? {needed} and it won't be."],
  ),
  demoList(
    'welcome',
    'Welcome',
    'Welcome',
    'A private message to each player a couple of minutes after they join, and not again for 6 hours. Say the basic rules: the Discord and the website go after it.',
    exactFrame({}, '', ` Discord: discord.gg/qsJFYGhSJ4 | Website: ${DEMO_SITE}`),
    ['Welcome! Rules: no cheating or exploits, no team killing or griefing, no racism or abuse, and listen to admins. Full rules on our Discord.'],
  ),
  demoList(
    'tenMinutes',
    '10 minutes in',
    '10 minutes in',
    '10 minutes after the match goes live. The line is the whole message, so say where the rules and the website are.',
    exactFrame({ site: DEMO_SITE }, '', ''),
    ['10 minutes in and nobody has rage quit yet. Rules are in our Discord, leaderboard at {site}', 'Still alive? Impressive. Rules are in our Discord, and your K/D is on the leaderboard at {site}'],
  ),
  ...[
    ['lonestar', 'Lonestar', ['Lonestar leads on {score}! Screenshot it, this never happens.', 'Lonestar leads on {score}! The default pick is cooking. Yeehaw.']],
    ['manticore', 'Manticore', ['Manticore leads on {score}. Green winning? Shocking. Truly.', 'Manticore leads on {score}. Green is winning. Water is also wet.']],
    ['valkyra', 'Valkyra', ['Valkyra leads on {score}. Not my points, OUR points, comrade.', 'Valkyra leads on {score}. The motherland is pleased. For now.']],
  ].map(([key, name, lines]) =>
    demoFaction('Halfway', key, name, `When ${name} is in front at half the winning score. "Halfway there!" goes before it, and the leaderboard after it.`, halfwayFrame(name), lines),
  ),
  demoList(
    'halfwayLevel',
    'Halfway',
    'Level scores',
    'At half the winning score when the top teams are level. These go in place of "Halfway there!", with the leaderboard after them.',
    exactFrame({}, '', DEMO_HALFWAY_AFTER),
    ["Halfway there and it's neck and neck!", 'Halfway there and dead level. Somebody do something.'],
  ),
  demoList(
    'halfwayOther',
    'Halfway',
    'Any other team',
    'When a team without a list of its own is in front at half the winning score. "Halfway there!" goes before it, and the leaderboard after it.',
    halfwayFrame('Other team'),
    ['{team} leads on {score}!'],
  ),
  ...[
    ['lonestar', 'Lonestar', ['Lonestar has {score}! The default pick is about to win. Clip it.', 'Lonestar has {score}! Historians will study this match.']],
    ['manticore', 'Manticore', ['Manticore has {score}. Green about to win again. Groundbreaking.', 'Manticore has {score}. Green diff incoming.']],
    ['valkyra', 'Valkyra', ['Valkyra has {score}! Victory for the motherland is in sight, comrades.', 'Valkyra has {score}! Start rehearsing the victory parade.']],
  ].map(([key, name, lines]) =>
    demoFaction('Nearly won', key, name, `When ${name} is the first team to reach 90% of the winning score. The leaderboard goes after it.`, nearlyFrame(name), lines),
  ),
  demoList(
    'nearlyOther',
    'Nearly won',
    'Any other team',
    'When a team without a list of its own is the first to reach 90% of the winning score. The leaderboard goes after it.',
    nearlyFrame('Other team'),
    ['{team} has {score} points!'],
  ),
];

// What the demo's staff changed: one list, by Sarge, yesterday.
const demoLineState = {
  'halfway.lonestar': {
    lines: ['Lonestar leads on {score}! Somebody finally parked the spawn truck.', 'Lonestar leads on {score}! Reddit wrote blue off. Reddit was wrong.'],
    changed: { at: Date.now() - DAY, by: 'demo', byName: 'Sarge' },
  },
};

const demoLinesPage = () => ({
  max: 200,
  maxLines: 50,
  lists: DEMO_LISTS.map((list) => {
    const own = demoLineState[list.id];
    return own ? { ...list, lines: [...own.lines], changed: { ...own.changed } } : { ...list, lines: [...list.lines] };
  }),
});

export const demoLines = async () => ({ ok: true, status: 200, json: demoLinesPage() });

// A change, as the bot makes it: refused with a reason, or the page as it is after it.
export const demoLinesChange = async (body) => {
  const refuse = (error) => ({ ok: false, json: { error } });
  const list = DEMO_LISTS.find((l) => l.id === body.list);
  if (!list) return refuse('There is no list of lines by that name. Reload the page.');
  if (body.action === 'reset') {
    delete demoLineState[list.id];
    return { ok: true, json: demoLinesPage() };
  }
  const lines = linesToSave(body.lines);
  if (lines.length === 0) return refuse("Keep at least one line. To go back to the bot's own lines, use \"Use the bot's lines\".");
  if (lines.length > 50) return refuse('A list can have at most 50 lines.');
  const wrong = lines.findIndex((line) => lineProblem(list, line, 200) !== null);
  if (wrong >= 0) return refuse(`Line ${wrong + 1}: ${lineProblem(list, lines[wrong], 200)}`);
  if (sameLines(lines, list.lines)) delete demoLineState[list.id];
  else demoLineState[list.id] = { lines, changed: { at: Date.now(), by: 'demo', byName: 'Sarge' } };
  return { ok: true, json: demoLinesPage() };
};

// The Weapon rules tab: some of the weapons the bot names, with their kill feed tags, as the bot sends them, and its
// three ready-made rules, one of them turned on.
const DEMO_WEAPONS = [
  ...[
    ['AK74', 'Id.Item.AK74M'],
    ['AMR 50', 'Id.Item.SR_04'],
    ['BMR-308', 'Id.Item.RFB'],
    ['Galil', 'Id.Item.WEPN_029'],
    ['M249 SAW', 'Id.Item.M249'],
    ['M4', 'Id.Item.M4'],
    ['MAAWS', 'Id.Item.CGM4'],
    ['MGL-40', 'Id.Item.MMGL'],
    ['PKM', 'Id.Item.LMG_02'],
    ['RPG-7', 'Id.Item.RPG7'],
  ].map(([name, tag]) => ({ name, kind: 'weapon', tags: [tag] })),
  { name: 'AT mine', kind: 'placed', tags: ['Id.Item.ATMine'] },
  { name: 'Claymore', kind: 'placed', tags: ['Id.Item.Claymore'] },
  { name: 'Humvee M249', kind: 'vehicle-weapon', tags: ['Id.Vehicle.WeaponExtension.WHL_05.RingTurret'] },
  { name: 'Humvee minigun', kind: 'vehicle-weapon', tags: ['Id.Vehicle.WeaponExtension.WHL_05.RingMinigun'] },
  { name: 'Kodiak M249', kind: 'vehicle-weapon', tags: ['Id.Vehicle.WeaponExtension.WHL_02.SUV.RingTurret'] },
  { name: 'L2A6 cannon', kind: 'vehicle-weapon', tags: ['Id.Vehicle.WeaponExtension.TNK_01.Heavy'] },
  { name: 'Ural Defender M249', kind: 'vehicle-weapon', tags: ['Id.Vehicle.WeaponExtension.WHL_07.MachineGun'] },
  { name: 'L81 mortar', kind: 'emplacement', tags: ['Vehicle.Variant.Stationary.Mortar', 'Id.Vehicle.WeaponExtension.STN_03.MainBarrel'] },
  { name: 'Humvee', kind: 'vehicle', tags: ['Vehicle.Variant.Land.Wheeled.Humvee.Default'] },
  {
    name: 'M113 APC',
    kind: 'vehicle',
    tags: [
      'Vehicle.Variant.Land.Tracked.SpawnVehicle.Lonestar',
      'Vehicle.Variant.Land.Tracked.SpawnVehicle.Valkyra',
      'Vehicle.Variant.Land.Tracked.SpawnVehicle.Manticore',
    ],
  },
];

const DEMO_AFTER = ' | Rules: our Discord at gaminginit.com';
const DEMO_LIMITS = { warning: 200 - 'Warning 4 of 5: '.length - DEMO_AFTER.length, kick: 200 - DEMO_AFTER.length };

const demoRuleState = {
  rules: [
    {
      id: 'humvee-gunner',
      name: 'Humvee gunner',
      weapons: ['Id.Vehicle.WeaponExtension.WHL_05.RingTurret', 'Id.Vehicle.WeaponExtension.WHL_05.RingMinigun'],
      mode: 'warn-kick',
      warnings: 1,
      warning: 'No kills from the Humvee gun. It is not allowed on this server.',
      kick: 'Kills from the Humvee gun, which is not allowed on this server',
      changed: { at: Date.now() - 2 * HOUR, by: 'demo', byName: 'Sarge' },
    },
    {
      id: 'kodiak-gunner',
      name: 'Kodiak gunner',
      weapons: ['Id.Vehicle.WeaponExtension.WHL_02.SUV.RingTurret'],
      mode: 'off',
      warnings: 1,
      warning: 'No kills from the Kodiak gun. It is not allowed on this server.',
      kick: 'Kills from the Kodiak gun, which is not allowed on this server',
      changed: null,
    },
    {
      id: 'mgl',
      name: 'MGL',
      weapons: ['Id.Item.MMGL'],
      mode: 'off',
      warnings: 1,
      warning: 'The MGL is not allowed on this server. Switch weapon.',
      kick: 'Using the MGL, which is not allowed on this server',
      changed: null,
    },
  ],
  today: { 'humvee-gunner': { warned: 3, kicked: 1 } },
  made: 0,
};

const demoRulesPage = () => ({
  feed: true,
  after: DEMO_AFTER,
  limits: DEMO_LIMITS,
  maxRules: 20,
  maxWeapons: 20,
  maxWarnings: 5,
  maxName: 40,
  weapons: DEMO_WEAPONS,
  rules: demoRuleState.rules.map((r) => ({ ...r, weapons: [...r.weapons], today: demoRuleState.today[r.id] ?? { warned: 0, kicked: 0 } })),
});

export const demoRules = async () => ({ ok: true, status: 200, json: demoRulesPage() });

// A change, as the bot makes it: refused with a reason, or the page as it is after it.
export const demoRulesChange = async (body) => {
  const refuse = (error) => ({ ok: false, json: { error } });
  if (body.action === 'remove') {
    if (!demoRuleState.rules.some((r) => r.id === body.id)) return refuse('That rule is gone already. Reload the page.');
    demoRuleState.rules = demoRuleState.rules.filter((r) => r.id !== body.id);
    return { ok: true, json: demoRulesPage() };
  }
  const page = demoRulesPage();
  const why = ruleProblem(body, page.rules, page);
  if (why) return refuse(why);
  const rule = {
    id: body.id ?? `demo-${(demoRuleState.made += 1)}`,
    name: tidy(body.name),
    weapons: [...body.weapons],
    mode: body.mode,
    warnings: body.warnings,
    warning: tidy(body.warning),
    kick: tidy(body.kick),
    changed: { at: Date.now(), by: 'demo', byName: 'Sarge' },
  };
  demoRuleState.rules = body.id === null ? [...demoRuleState.rules, rule] : demoRuleState.rules.map((r) => (r.id === rule.id ? rule : r));
  return { ok: true, json: demoRulesPage() };
};

// A signed-in player, for /account?demo: linked, in the Discord, with VIP, as the bot's GET /api/account sends it.
export const demoAccount = (now) => ({
  user: { id: '100000000000000009', name: 'Sarge' },
  member: true,
  steam: { linked: true, via: 'discord' },
  playerId: 'd00000000000',
  vip: { until: now + 4 * 86_400_000, source: 'seeding' },
  alerts: true,
  private: { on: false, byYou: false },
  ballot: null,
  perks: { role: true, vipRole: true, messages: true, join: true },
});

// The staff page's Discord growth card: the bot's GET /api/admin/growth, with sample numbers.
export const demoGrowth = () => ({
  clicks: {
    days: 30,
    total: 214,
    places: [
      { src: 'short', clicks: 96 },
      { src: 'home-hero', clicks: 58 },
      { src: 'home-nav', clicks: 31 },
      { src: 'vote-peek', clicks: 17 },
      { src: 'season-end', clicks: 12 },
    ],
  },
  accounts: { accounts: 64, linked: 51, members: 58, joinedOnSite: 19, withVipRole: 6 },
  members: 412,
});
