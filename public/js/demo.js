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
    vip: { seedDays: 3, seedMinutes: 10, windowDays: 7, lengthDays: 7 },
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
  };
};
