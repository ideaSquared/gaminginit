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

const top = (seed, count = 5) =>
  NAMES.slice(seed % 4, (seed % 4) + count).map((name, i) => ({
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
    thresholds: { seeding: 1, live: LIVE },
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
  };
};

// Thirty days of made-up totals for ten regulars.
const leaderboard = () => {
  const players = NAMES.map((name, i) => ({
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
