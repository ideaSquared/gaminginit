// Made-up numbers in the same shape as the bot's /api/stats, for previewing the page: open it with ?demo.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Players by UTC hour on a typical day: quiet overnight, filling up through the evening.
const CURVE = [38, 24, 10, 4, 0, 0, 0, 0, 2, 4, 6, 9, 14, 18, 22, 26, 31, 40, 52, 61, 64, 60, 55, 46];
const NAMES = ['Kestrel', 'Bravo_Six', 'Moth', 'Nightjar', 'Pike', 'Rook', 'Sable', 'Tusk', 'Vex', 'Ash'];
const MAPS = ['Bakurani', 'Ozeti', 'Zestafona'];
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
      factionScores: scores(i),
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
    kdMinMatches: 3,
    kills: by((p) => p.kills),
    kd: by((p) => p.kills / Math.max(p.deaths, 1)),
    playtime: by((p) => p.seedingMinutes + p.liveMinutes),
    seeding: by((p) => p.seedDays * 1e6 + p.seedingMinutes).filter((p) => p.seedingMinutes > 0),
  };
};

// Who has VIP from seeding: the regulars with 3 seed days or more, each with some of their week left.
const seederVip = (now) =>
  [6, 0, 2, 4, 8].map((i, k) => ({ id: demoId(i), name: NAMES[i], until: now + (6 - k) * DAY + 3 * HOUR }));

// Thirty days of made-up results: each map's matches, wins by team (in SIDES order), draws and average minutes.
const TEAM_MAPS = [
  ['Ozeti', [28, 21, 13], 2, 41],
  ['Bakurani', [15, 22, 14], 1, 38],
  ['Zestafona', [12, 9, 9], 1, 46],
];

const teamBoard = (now) => {
  const SIDES = ['Valkyra', 'Lonestar', 'Manticore'];
  const maps = TEAM_MAPS.map(([map, wins, draws, minutes]) => ({
    map,
    matches: wins.reduce((a, b) => a + b, 0) + draws,
    draws,
    averageMs: minutes * MINUTE,
    teams: SIDES.map((name, i) => ({ name, wins: wins[i] })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
  }));
  const matches = maps.reduce((sum, m) => sum + m.matches, 0);
  const scores = (list) => list.map(([name, score]) => ({ name, score, colorHex: SIDE_COLOURS[name] }));
  return {
    days: 30,
    matches,
    draws: maps.reduce((sum, m) => sum + m.draws, 0),
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
  const longest = top.reduce((best, w) => (w.longest.distance > best.longest.distance ? w : best));
  return {
    days: 30,
    since: new Date(now - 12 * DAY).toISOString().slice(0, 10),
    kills,
    headshots: top.reduce((sum, w) => sum + w.headshots, 0) + 40,
    top,
    longest: { weapon: longest.name, ...longest.longest },
  };
};

const SIDES = ['Valkyra', 'Lonestar', 'Manticore'];
// Made-up colours for the sample; the real ones come from the game server.
const SIDE_COLOURS = { Valkyra: '#d93a3a', Lonestar: '#3a7bd9', Manticore: '#e0a020' };
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
    ranks: { days: 30, kdMinMatches: 3, players: 214, kills: index + 1, kd: index < 5 ? 5 - index : 14 + index, playtime: index * 2 + 2, seeding: index === 0 ? 1 : null },
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
        if (killer.longest === null || capped > killer.longest) {
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
  const row = (name, t) => ({
    ...ref(name),
    teamKills: 0,
    vehicleTeamKills: 0,
    teamKilled: 0,
    suicides: 0,
    vehicleSuicides: 0,
    mostKilledTeammate: null,
    flags: [],
    flaggedDays: 0,
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
      suicides: 3 * scale,
      vehicleSuicides: 2 * scale,
      mostKilledTeammate: { ...ref('Moth'), kills: 3 * scale },
      flags: ['teamKills', 'sameTeammate', 'vehicleSuicides'],
      flaggedDays: Math.min(days, 2 * scale - 1),
      banned: days > 1,
    }),
    row('Tusk', { teamKills: 3 * scale, teamKilled: 1, suicides: 12, flags: ['teamKills', 'suicides'], flaggedDays: Math.min(days, scale) }),
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
      banned: false,
      reserved: ['Kestrel', 'Moth', 'Rook', 'Sable'].includes(name),
    };
  });
  const sum = (key) => players.reduce((n, p) => n + p[key], 0);
  return {
    generatedAt: now,
    days,
    feedSince: new Date(now - 40 * DAY).toISOString().slice(0, 10),
    flags: { teamKills: 3, sameTeammate: 2, vehicleSuicides: 2, suicides: 10 },
    totals: {
      teamKills: sum('teamKills'),
      vehicleTeamKills: sum('vehicleTeamKills'),
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
    reserved: {
      players: [
        { player: ref('Kestrel'), bot: { since: now - 2 * DAY, until: now + 5 * DAY } },
        { player: ref('Moth'), bot: { since: now - 6 * DAY, until: now + DAY } },
        { player: ref('Rook'), bot: null },
        { player: ref('Sable'), bot: null },
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
      risk: { high: 4, medium: 2 },
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
  {"name":"switchteam","description":"Move a player to another team (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Who to move: pick from the players in game","required":true,"autocomplete":true},{"type":3,"name":"team","description":"The team to move them to (with two teams, leave it out for the other one)","required":false,"choices":[{"name":"🤠 Lonestar","value":"Lonestar"},{"name":"🦂 Manticore","value":"Manticore"},{"name":"🐻 Valkyra","value":"Valkyra"}]}]},
  {"name":"ban","description":"Ban a player for a set time or for good (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"player","description":"Pick the player, or type a name or Steam ID","required":true,"autocomplete":true},{"type":3,"name":"duration","description":"How long","required":true,"choices":[{"name":"1 hour","value":"1h"},{"name":"1 day","value":"1d"},{"name":"3 days","value":"3d"},{"name":"7 days","value":"7d"},{"name":"30 days","value":"30d"},{"name":"Permanent","value":"permanent"}]},{"type":3,"name":"reason","description":"Why; kept with the ban","required":true,"max_length":200}]},
  {"name":"unban","description":"Lift a ban (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"steam_id","description":"Pick from the banned players, or type a Steam ID","required":true,"autocomplete":true}]},
  {"name":"setnextmap","description":"Set the map and setup after this match, without changing the rotation (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"map","description":"Pick the map from the list","required":true,"autocomplete":true},{"type":3,"name":"mode","description":"Game mode (default: as in the rotation)","required":false,"autocomplete":true},{"type":5,"name":"infantry_only","description":"Infantry only (default: as in the rotation)","required":false},{"type":5,"name":"hardcore","description":"Hardcore (default: as in the rotation)","required":false},{"type":3,"name":"lighting","description":"Time of day and weather (default: as in the rotation)","required":false,"autocomplete":true},{"type":3,"name":"zones","description":"Control zone layout (default: as in the rotation)","required":false,"autocomplete":true}]},
  {"name":"changemap","description":"End the current match now and change map and setup (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":3,"name":"map","description":"Pick the map from the list","required":true,"autocomplete":true},{"type":3,"name":"mode","description":"Game mode (default: as in the rotation)","required":false,"autocomplete":true},{"type":5,"name":"infantry_only","description":"Infantry only (default: as in the rotation)","required":false},{"type":5,"name":"hardcore","description":"Hardcore (default: as in the rotation)","required":false},{"type":3,"name":"lighting","description":"Time of day and weather (default: as in the rotation)","required":false,"autocomplete":true},{"type":3,"name":"zones","description":"Control zone layout (default: as in the rotation)","required":false,"autocomplete":true}]},
  {"name":"vip","description":"Give or take away a reserved slot (staff only)","type":1,"default_member_permissions":"8","contexts":[0],"options":[{"type":1,"name":"add","description":"Give a player a reserved slot for a number of days","options":[{"type":3,"name":"steam_id","description":"Pick the player, or type a name or Steam ID","required":true,"autocomplete":true},{"type":4,"name":"days","description":"How many days","required":true,"min_value":1,"max_value":365}]},{"type":1,"name":"remove","description":"Take a player off the reserved list; automatic VIP skips them for 7 days","options":[{"type":3,"name":"steam_id","description":"Pick from the reserved list, or type a Steam ID","required":true,"autocomplete":true}]}]},
];

const DEMO_MAPS = [
  { name: '🟧 Bakurani', value: 'Kavkazi' },
  { name: '🟦 Ozeti', value: 'Europe' },
  { name: '🟪 Zestafona', value: 'Zestafona' },
];

// What the bot answers the admin tools in ?demo: sample players and maps to pick from, and nothing done.
export const demoCall = async (path, { name, options, focused }) => {
  if (path === 'admin/suggest') {
    const typed = (options[focused] ?? '').toLowerCase();
    const choices =
      focused === 'player' || focused === 'steam_id'
        ? NAMES.map((n, i) => ({ name: `${n} · ${i % 2 ? 'Manticore' : 'Valkyra'} · 7656119800000${String(i).padStart(4, '0')}`, value: `7656119800000${String(i).padStart(4, '0')}` }))
        : focused === 'map'
          ? DEMO_MAPS
          : [];
    return { ok: true, json: { choices: choices.filter((c) => c.name.toLowerCase().includes(typed) || c.value.includes(typed)) } };
  }
  const sub = options.subcommand ? ` ${options.subcommand}` : '';
  return { ok: true, json: { content: `Sample only: nothing was done. Signed in, this runs **/${name}${sub}** on the bot, as you.` } };
};
