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

// The busiest `length` hours in a row, wrapping past midnight: { start, length, average }. Only runs where every hour
// has readings count, since a missing hour is unknown rather than empty. Null when no run has players.
export const busiestHours = (averages, length = 3) => {
  let best = null;
  for (let start = 0; start < 24; start++) {
    const run = Array.from({ length }, (_, i) => averages[(start + i) % 24] ?? null);
    if (run.includes(null)) continue;
    const average = run.reduce((sum, a) => sum + a, 0) / length;
    if (average > (best?.average ?? 0)) best = { start, length, average };
  }
  return best;
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
