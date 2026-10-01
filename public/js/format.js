// Pure helpers for turning the bot's /api/stats numbers into text. No DOM here, so they can be tested in Node.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The bot checks the server once a minute; a reading older than this means it could not reach the server.
export const STALE_MS = 3 * MINUTE;

export const timeAgo = (ms) => {
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  const days = Math.floor(ms / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export const formatDuration = (ms) => {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`;
};

export const formatHours = (minutes) => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
};

export const compact = (n) => {
  if (n < 10_000) return n.toLocaleString('en-GB');
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
};

// Each map has its own colour, the same hues as the Discord bot (🟧 Bakurani, 🟦 Ozeti, 🟪 Zestafona). The key picks
// it in the stylesheet; a map without one keeps the plain tag.
const COLOURED_MAPS = ['bakurani', 'ozeti', 'zestafona'];

export const mapKey = (name) => {
  const key = String(name ?? '').trim().toLowerCase();
  return COLOURED_MAPS.includes(key) ? key : null;
};

export const kd = (kills, deaths) => (kills / Math.max(deaths, 1)).toFixed(2);

const byScore = (scores) => [...scores].sort((a, b) => b.score - a.score);

// "Valkyra won 300–255", "Draw 100–100", or null when the bot has no scores. With three or more factions, it names
// them all: "Valkyra won 100, Kharr 67, Haldor 41".
export const result = (scores) => {
  const ranked = byScore(scores ?? []);
  const [first, second, ...rest] = ranked;
  if (!first || !second) return null;
  const winner = first.score === second.score ? null : first.name;
  if (rest.length === 0) {
    return { winner, text: winner ? `${first.name} won ${first.score}–${second.score}` : `Draw ${first.score}–${second.score}` };
  }
  const others = ranked.slice(1).map((s) => `${s.name} ${s.score}`).join(', ');
  return { winner, text: winner ? `${first.name} won ${first.score}, ${others}` : `Draw: ${first.name} ${first.score}, ${others}` };
};

// The newest finished matches first, at most `count` of them.
export const latestMatches = (matches, count) => [...(matches ?? [])].sort((a, b) => b.endedAt - a.endedAt).slice(0, count);

// What the server is doing, as the page should describe it.
export const serverState = (stats, now) => {
  const server = stats?.server;
  if (!server) return { kind: 'waiting', label: 'Waiting', detail: 'Waiting for the first reading from the bot.' };
  if (now - server.seenAt > STALE_MS) {
    return { kind: 'offline', label: 'Offline', detail: `Not responding. Last seen ${timeAgo(now - server.seenAt)}.` };
  }
  if (server.phase === 'live') return { kind: 'live', label: 'Live', detail: 'Full match in progress.' };
  const vip = stats.vip ? ' Seeding earns VIP.' : '';
  if (server.phase === 'seeding') {
    const needed = Math.max(0, stats.thresholds.live - server.players);
    return {
      kind: 'seeding',
      label: 'Seeding',
      detail: `${needed} more player${needed === 1 ? '' : 's'} to go live. Jump in and help fill it.${vip}`,
    };
  }
  return { kind: 'empty', label: 'Empty', detail: `Nobody on yet. Be the first in and start the seed.${vip}` };
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const span = (days) => (days === 7 ? 'a week' : plural(days, 'day'));

// Players for each server state, from the bot's thresholds: "0 players", "1–19 players", "20+ players".
export const phaseRanges = ({ seeding, live }) => ({
  empty: seeding <= 1 ? '0 players' : `0–${seeding - 1} players`,
  seeding: seeding === live - 1 ? plural(seeding, 'player') : `${seeding}–${live - 1} players`,
  live: `${live}+ players`,
});

// What an empty server means. With a seeding threshold above 1, a few players can be on before it counts as seeding.
export const emptyNote = ({ seeding }) =>
  seeding <= 1
    ? 'Nobody is on. The first player to join starts the seed.'
    : `Fewer than ${seeding} players on. Seeding starts once ${seeding} are in.`;

// What seeding earns, from the bot's `vip` rule: "Seed on 3 days in a week and get a reserved slot for a week."
export const vipOffer = (vip) =>
  `Seed on ${plural(vip.seedDays, 'day')} in ${span(vip.windowDays)} and get a reserved slot for ${span(vip.lengthDays)}.`;

export const vipDetail = (vip) =>
  `A day counts when you're on for more than ${vip.seedMinutes} minutes while the server seeds, and it goes live. ` +
  'A reserved slot lets you skip the queue when the server is full. Our bot adds you automatically from the ' +
  "server's next daily restart. Keep seeding to keep it.";

// The leaderboard's boards: what each one shows, besides the rank and the name.
export const BOARDS = [
  {
    key: 'kills',
    title: 'Most kills',
    headings: ['Kills', 'K/D'],
    cells: (p) => [String(p.kills), kd(p.kills, p.deaths)],
  },
  {
    key: 'kd',
    title: 'Best K/D',
    sub: (board) => `At least ${board.kdMinMatches} matches.`,
    headings: ['K/D', 'Kills'],
    cells: (p) => [kd(p.kills, p.deaths), String(p.kills)],
  },
  {
    key: 'playtime',
    title: 'Most time played',
    headings: ['Time', 'Matches'],
    cells: (p) => [formatHours(p.seedingMinutes + p.liveMinutes), String(p.matches)],
  },
  {
    key: 'seeding',
    title: 'Top seeders',
    sub: () => 'Time on the server before it went live.',
    headings: ['Seed days', 'Seeding'],
    cells: (p) => [String(p.seedDays), formatHours(p.seedingMinutes)],
  },
];

export const peak = (history) => history.reduce((max, [, players]) => Math.max(max, players), 0);

// Average players in each hour of the day, 0 to 23, from history samples. Local hours unless hourOf says otherwise.
// An hour with no readings is null.
export const hourlyAverages = (history, hourOf = (at) => new Date(at).getHours()) => {
  const hours = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
  for (const [at, players] of history) {
    const hour = hours[hourOf(at)];
    hour.total += players;
    hour.count += 1;
  }
  return hours.map((h) => (h.count === 0 ? null : h.total / h.count));
};

// The bot's 14-day averages are by UTC hour; this moves them to the reader's local hours. offsetMinutes is
// Date#getTimezoneOffset (UTC minus local, so -60 in London in summer). Half-hour time zones round to the nearest hour.
export const toLocalHours = (utcAverages, offsetMinutes) => {
  const shift = Math.round(-offsetMinutes / 60);
  return Array.from({ length: 24 }, (_, hour) => utcAverages[(((hour - shift) % 24) + 24) % 24] ?? null);
};

// The players from which the server is busy, for a bot that does not send thresholds.busy.
export const BUSY_PLAYERS = 97;
// An hour is busy when at least this share of its readings had BUSY_PLAYERS or more.
export const BUSY_SHARE = 0.5;

// The share of readings (0 to 1) in each hour of the day with at least `threshold` players. Null for an hour with no
// readings.
export const busyShares = (history, threshold, hourOf) =>
  hourlyAverages(history.map(([at, players]) => [at, players >= threshold ? 1 : 0]), hourOf);

export const isBusy = (share) => share !== null && share !== undefined && share >= BUSY_SHARE;

// The busy hours as runs in a row, wrapping past midnight: [{ start, length }], earliest start first. Empty when no
// hour is busy.
export const busyRuns = (shares) => {
  const busy = Array.from({ length: 24 }, (_, hour) => isBusy(shares[hour]));
  if (busy.every(Boolean)) return [{ start: 0, length: 24 }];
  const runs = [];
  // Starting after a quiet hour keeps a run across midnight whole.
  const quiet = busy.indexOf(false);
  for (let i = 1; i <= 24; i++) {
    const hour = (quiet + i) % 24;
    if (!busy[hour]) continue;
    if (busy[(hour + 23) % 24]) runs[runs.length - 1].length += 1;
    else runs.push({ start: hour, length: 1 });
  }
  return runs.sort((a, b) => a.start - b.start);
};

export const playerCount = (n) => `${n} player${n === 1 ? '' : 's'}`;

// Splits samples wherever the bot missed readings, so the chart shows a gap instead of a made-up line.
export const segments = (history, maxGapMs = STALE_MS) =>
  history.reduce((parts, sample, i) => {
    const previous = history[i - 1];
    if (previous === undefined || sample[0] - previous[0] > maxGapMs) parts.push([sample]);
    else parts[parts.length - 1].push(sample);
    return parts;
  }, []);

// A round axis maximum with evenly spaced ticks: 0, 16, 32, 48, 64 or 0, 25, 50, 75, 100.
export const niceScale = (value, tickCount = 4) => {
  const max = Math.max(1, value);
  const rough = max / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  // Player counts are whole numbers, so steps are too.
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough && Number.isInteger(s)) ?? 10 * magnitude);
  const top = Math.ceil(max / step) * step;
  return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
};

// "Valkyra 43–32 Kharr", in the order the server lists the factions.
export const scoreLine = (scores) => {
  const list = scores ?? [];
  const [a, b] = list;
  if (list.length === 2 && a && b) return `${a.name} ${a.score}–${b.score} ${b.name}`;
  return list.map((s) => `${s.name} ${s.score}`).join(' · ');
};

// Player pages. The bot sends each player's days and matches (GET /api/player); these turn them into the page's
// numbers. Days are UTC dates, like the bot's records.

export const utcDay = (at) => new Date(at).toISOString().slice(0, 10);

const shiftDay = (day, days) => utcDay(Date.parse(`${day}T00:00:00Z`) + days * DAY);

// "1st", "2nd", "3rd", "4th", "11th", "22nd".
export const ordinal = (n) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
};

export const percent = (share) => (share === null ? '–' : `${Math.round(share * 100)}%`);

// The player's days and matches in the last `days` UTC days, today included. A match counts on the day it ended.
export const inPeriod = (profile, days, now) => {
  const first = utcDay(now - (days - 1) * DAY);
  return {
    activity: profile.activity.filter((d) => d.day >= first),
    matches: profile.matches.filter((m) => utcDay(m.endedAt) >= first),
  };
};

export const played = (t) => t.seedingMinutes + t.liveMinutes;

// Totals over some of a player's days, and how many days they played.
export const sumDays = (activity) =>
  activity.reduce(
    (t, d) => ({
      days: t.days + 1,
      seedingMinutes: t.seedingMinutes + d.seedingMinutes,
      liveMinutes: t.liveMinutes + d.liveMinutes,
      seedDays: t.seedDays + d.seedDays,
      matches: t.matches + d.matches,
      kills: t.kills + d.kills,
      deaths: t.deaths + d.deaths,
    }),
    { days: 0, seedingMinutes: 0, liveMinutes: 0, seedDays: 0, matches: 0, kills: 0, deaths: 0 },
  );

// Wins, losses and draws, from the matches whose result is known. The share is null when none is.
export const results = (matches) => {
  const count = (result) => matches.filter((m) => m.result === result).length;
  const won = count('won');
  const lost = count('lost');
  const draw = count('draw');
  const decided = won + lost + draw;
  return { won, lost, draw, decided, share: decided === 0 ? null : won / decided };
};

// "Lonestar", "LONESTAR" and "Lone Star" are the same side.
const sideKey = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

const groupBy = (matches, key) => {
  const groups = new Map();
  for (const m of matches) {
    const k = key(m);
    if (k === null) continue;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  return [...groups.values()];
};

const most = (list, value) => list.reduce((best, item) => (best === null || value(item) > value(best) ? item : best), null);

// Each map they played, most played first: matches, results, kills, deaths and their best match on it.
export const byMap = (matches) =>
  groupBy(matches, (m) => m.map || null)
    .map((list) => ({
      map: list[0].map,
      matches: list.length,
      ...results(list),
      kills: list.reduce((sum, m) => sum + m.kills, 0),
      deaths: list.reduce((sum, m) => sum + m.deaths, 0),
      best: most(list, (m) => m.kills),
    }))
    .sort((a, b) => b.matches - a.matches || a.map.localeCompare(b.map));

// Each side they played on, most played first, named as in their latest match on it. Matches without a side are
// left out.
export const bySide = (matches) =>
  groupBy(matches, (m) => (m.faction ? sideKey(m.faction) : null))
    .map((list) => ({ faction: list[0].faction, matches: list.length, ...results(list) }))
    .sort((a, b) => b.matches - a.matches || a.faction.localeCompare(b.faction));

// A K/D only counts as a best with at least this many kills, so one kill and no deaths is not a record.
export const BEST_KD_KILLS = 5;

// Their best match by kills and by K/D, best day by kills, and how often they topped the scoreboard (MVP) or made the
// top 3. A tie goes to the earlier one, which got there first. Matches come newest first.
export const bests = (matches, activity) => {
  const oldestFirst = [...matches].reverse();
  const scored = oldestFirst.filter((m) => m.kills > 0);
  const day = most(activity.filter((d) => d.kills > 0), (d) => d.kills);
  return {
    kills: most(scored, (m) => m.kills),
    kd: most(scored.filter((m) => m.kills >= BEST_KD_KILLS), (m) => m.kills / Math.max(m.deaths, 1)),
    day,
    mvps: scored.filter((m) => m.place === 1).length,
    podiums: scored.filter((m) => m.place <= 3).length,
  };
};

// Days in a row on the server: the longest run, and the current one, which ends today, or yesterday while they have
// not played yet today.
export const streaks = (activity, today) => {
  const days = new Set(activity.filter((d) => played(d) > 0 || d.matches > 0).map((d) => d.day));
  let longest = 0;
  for (const day of days) {
    if (days.has(shiftDay(day, -1))) continue;
    let length = 1;
    while (days.has(shiftDay(day, length))) length += 1;
    longest = Math.max(longest, length);
  }
  let current = 0;
  let day = days.has(today) ? today : shiftDay(today, -1);
  while (days.has(day)) {
    current += 1;
    day = shiftDay(day, -1);
  }
  return { current, longest };
};

// The calendar's columns: one per week, Monday first, ending with the week that has today. Days after today, and
// before `first`, are null.
export const calendarWeeks = (today, weeks, first) => {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = shiftDay(today, -weekday - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = shiftDay(start, w * 7 + d);
      return day > today || day < first ? null : day;
    }),
  );
};

// Minutes played from which a calendar day takes the next shade: under 30 minutes, under 1.5 hours, under 3 hours,
// then 3 hours or more.
export const HEAT_STEPS = [30, 90, 180];

export const heatLevel = (minutes) => (minutes <= 0 ? 0 : 1 + HEAT_STEPS.filter((step) => minutes >= step).length);

// "Today", "Yesterday", "3 days ago", from UTC days.
export const daysAgo = (day, today) => {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

// How close a player is to seeder VIP, under the bot's own rule. With VIP already, seeding again keeps it: the bot
// renews it for players who earned it again by the time it ends.
export const seedProgress = ({ rule, seedDays }, hasVip = false) => {
  const days = `in the last ${plural(rule.windowDays, 'day')}`;
  const goal = hasVip ? `keeps the reserved slot for another ${span(rule.lengthDays).replace(/^a /, '')}` : 'earns a reserved slot';
  const left = rule.seedDays - seedDays;
  if (left <= 0) return `${plural(seedDays, 'seed day')} ${days}. That ${goal}.`;
  if (seedDays === 0) return `No seed days ${days} yet. Seeding on ${plural(rule.seedDays, 'day')} in ${span(rule.windowDays)} ${goal}.`;
  return `${seedDays} of ${plural(rule.seedDays, 'seed day')} ${days}. ${left} more ${goal}.`;
};

// What each leaderboard place reads as in a player's highlights: "#3 in kills".
const RANK_LABELS = { kills: 'in kills', kd: 'in K/D', playtime: 'in time played', seeding: 'seeder' };

// Places on the leaderboard: only the top 10 are on it.
export const LEADERBOARD_SIZE = 10;

// The player's leaderboard places that make the top 10, best first.
export const topRanks = (ranks) =>
  Object.entries(RANK_LABELS)
    .filter(([key]) => ranks?.[key] != null && ranks[key] <= LEADERBOARD_SIZE)
    .map(([key, label]) => ({ key, place: ranks[key], text: `#${ranks[key]} ${label}` }))
    .sort((a, b) => a.place - b.place);

const fold = (text) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

// Players whose name has the search in it, ignoring case and accents. Names that start with it come first; otherwise
// the list keeps its order.
export const searchPlayers = (players, query) => {
  const q = fold(query.trim());
  if (q === '') return players;
  const matching = players.filter((p) => fold(p.name).includes(q));
  return [...matching.filter((p) => fold(p.name).startsWith(q)), ...matching.filter((p) => !fold(p.name).startsWith(q))];
};
