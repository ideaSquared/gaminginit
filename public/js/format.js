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

// How to write the hour of a clock time for `locale` (the reader's own when left out): no leading zero on a 12-hour
// clock, "7:00 PM", and the zero kept on a 24-hour one, "07:00", which is how those locales write it.
export const clockHour = (locale) => (new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ? 'numeric' : '2-digit');

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

// Whether the server is answering, so its players, map and score are worth showing.
export const isOnline = (state) => state.kind === 'live' || state.kind === 'seeding' || state.kind === 'empty';

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
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

// The leaderboard's boards: what each one shows, besides the rank and the name. A board with `keep` leaves out the
// rows it returns false for.
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
    // Some minutes of seeding, but never enough on one day to count as a seed day, does not make a top seeder.
    keep: (p) => p.seedDays > 0,
  },
];

// A board's rows from the bot's leaderboard, without the ones the board leaves out. The table numbers what is left, so
// the ranks stay 1, 2, 3 with no gap.
export const boardRows = (board, leaderboard) => (leaderboard?.[board.key] ?? []).filter(board.keep ?? (() => true));

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

// A span of times of day with the AM or PM said once when both ends share it: "7:00 – 10:00 PM". The browser knows
// how each locale writes it. Where it cannot, both ends are written out in full.
export const timeRange = (formatter, from, to) => {
  try {
    return formatter.formatRange(from, to);
  } catch {
    return `${formatter.format(from)}–${formatter.format(to)}`;
  }
};

// Which of a row of day labels need their month: the first one shown, and each one in a different month from the
// label before it. `days` are the labels' times in ms (UTC dates) and `shown` says which of them get a label at all.
export const monthStarts = (days, shown) => {
  let month = null;
  return days.map((at, i) => {
    if (!shown[i]) return false;
    const next = new Date(at).getUTCMonth();
    const starts = next !== month;
    month = next;
    return starts;
  });
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
export const sideKey = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

const channels = (hex) => {
  const match = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex ?? '');
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const toHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

// A side's colour in game (the server's "#3366ff" or "#3366ffff"), made light enough to read as text on the cards:
// mixed with white until it has 4.5:1 contrast. Null when the server gave no colour.
export const readableColour = (hex, background = '#13161b') => {
  const rgb = channels(hex);
  const bg = channels(background);
  if (rgb === null || bg === null) return null;
  for (let mix = 0; mix <= 1; mix += 0.05) {
    const blended = rgb.map((c) => c + (255 - c) * mix);
    if (contrast(blended, bg) >= 4.5) return toHex(blended);
  }
  return '#ffffff';
};

// A map's matches as one bar: each team's wins, in the order of `teams` (the overall standings, so a team keeps its
// place and colour on every map), then the draws. Each share is of the map's matches; teams with no wins are left out.
export const mapSegments = (map, teams) => {
  const wins = new Map(map.teams.map((t) => [sideKey(t.name), t.wins]));
  const segments = [...teams.map((t) => ({ name: t.name, count: wins.get(sideKey(t.name)) ?? 0 })), { name: null, count: map.draws }];
  return segments.filter((s) => s.count > 0).map((s) => ({ ...s, share: s.count / map.matches }));
};

// Each side's colour from the latest match that had one, by sideKey, readable on `background` (the cards' by default).
// Matches come newest first.
export const sideColours = (matches, background) => {
  const colours = new Map();
  for (const m of matches) {
    for (const s of m.factionScores ?? []) {
      const colour = readableColour(s.colorHex, background);
      if (colour && !colours.has(sideKey(s.name))) colours.set(sideKey(s.name), colour);
    }
  }
  return colours;
};

// The game's three factions in their colours in game: Lonestar blue, Manticore green, Valkyra red.
export const FACTION_HEX = { Lonestar: '#3a7bd9', Manticore: '#3fa34d', Valkyra: '#d93a3a' };

// A button's background (--surface-2), lighter than the cards, so text on one needs its own colours.
export const BUTTON_BACKGROUND = '#1a1e25';

// Each faction's colour, by sideKey, readable as text on a button, for where the server's own colours aren't to hand,
// such as the staff page's lists of lines.
export const factionColours = new Map(Object.entries(FACTION_HEX).map(([name, hex]) => [sideKey(name), readableColour(hex, BUTTON_BACKGROUND)]));

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

// Weapons. The bot adds up the game's kill feed by weapon: the top weapons over the last 30 days (`weapons` in
// /api/stats), and each player's weapons by day (`weapons` on their page).

// What a weapon is, beside its name, when it is not carried by hand. An emplacement is a mortar or another fixed
// weapon: the game counts them as vehicles, but nobody drives them.
export const WEAPON_KINDS = {
  placed: 'Placed',
  'vehicle-weapon': 'Vehicle gun',
  emplacement: 'Emplacement',
  vehicle: 'Vehicle',
  buildable: 'Built',
};

// "612 m", "1,204 m", and to a tenth under 10 m: "4.5 m".
export const metres = (distance) =>
  `${distance < 10 ? Number(distance.toFixed(1)) : Math.round(distance).toLocaleString('en-GB')} m`;

// A player's weapons over their days from `first` on, most kills first: kills, headshots and their longest kill with
// each. Tied weapons go by name.
export const weaponTotals = (used, first) => {
  const weapons = new Map();
  for (const w of used ?? []) {
    if (w.day < first) continue;
    const known = weapons.get(w.name) ?? { name: w.name, kind: w.kind, kills: 0, headshots: 0, longest: null };
    weapons.set(w.name, {
      ...known,
      kills: known.kills + w.kills,
      headshots: known.headshots + w.headshots,
      longest: w.longest === null ? known.longest : Math.max(known.longest ?? 0, w.longest),
    });
  }
  return [...weapons.values()].sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
};

// Their longest kill over those weapons, and what with. Only hand-held weapons count, as on the bot's boards: how far a
// mine was from whoever laid it, or an emplacement from its target, says nothing about their aim. Null when the feed
// sent no distances for them.
export const longestKill = (weapons) =>
  weapons.reduce(
    (best, w) => (w.kind === 'weapon' && w.longest !== null && (best === null || w.longest > best.distance) ? { distance: w.longest, weapon: w.name } : best),
    null,
  );

// The live page. The bot pushes the match on now (GET /api/live, and its WebSocket): the kill feed, each player's
// kills and streaks, and the match's highlights.

// What the game says about a death, as the kill feed shows it.
export const DEATH_TAGS = {
  RoadKill: 'Roadkill',
  Penetration: 'Wallbang',
  Ricochet: 'Ricochet',
  WeaponMelee: 'Melee',
  VehicleExplosion: 'Blown up',
  Falling: 'Fell',
  Suicide: 'Suicide',
};

// Kills close together: "Double kill", "Triple kill", "Quad kill", then "5× multi-kill". Null for one kill.
export const multiKill = (kills) => {
  if (kills < 2) return null;
  return { 2: 'Double kill', 3: 'Triple kill', 4: 'Quad kill' }[kills] ?? `${kills}× multi-kill`;
};

// Kills without dying from which the kill feed says so.
export const STREAK_SHOWN = 5;

// How long ago, short, for the kill feed: "now", "12s", "3m", "1h".
export const shortAgo = (ms) => {
  if (ms < 5_000) return 'now';
  if (ms < MINUTE) return `${Math.floor(ms / 1000)}s`;
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m`;
  return `${Math.floor(ms / HOUR)}h`;
};

// What the live page shows: 'loading' before the first update, 'match' with the kill feed's match (deaths still
// coming in mean the server is up, even when the bot's checks cannot reach it), 'offline' when the bot cannot reach
// the server, 'empty' with nobody on, 'scoreboard' when the bot has no kill feed (only the checks' scoreboard), or
// 'waiting' for the first death of the match on now.
export const liveState = (snapshot, now) => {
  if (!snapshot) return 'loading';
  if (snapshot.match) return 'match';
  const server = snapshot.server;
  if (!server || now - server.seenAt > STALE_MS) return 'offline';
  if (server.phase === 'empty' || !snapshot.currentMatch) return 'empty';
  return snapshot.feed ? 'waiting' : 'scoreboard';
};

// The staff page. Staff sign in with Discord through the bot, which sends them back here with a session token after
// `#session=`, or what went wrong after `#error=`. The page keeps the token and sends it with each request for the
// page's data (GET /api/admin/overview).

// What a sign-in that did not work says.
export const SIGN_IN_ERRORS = {
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in took too long or was started in another browser. Try again.',
  'not-member': 'That Discord account is not in our Discord server.',
  'not-staff': 'This page is for staff only: Discord Administrators and members with a staff role.',
  failed: 'Discord sign-in did not work. Try again in a minute.',
};

// What the bot sent back after `#`: { session } or { error }, or null for anything else.
export const signInResult = (hash) => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const session = params.get('session');
  if (session && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session)) return { session };
  const error = params.get('error');
  if (error) return { error: SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.failed };
  return null;
};

// The Steam64 ID staff typed or pasted to link their account, as the bot reads it: the 17-digit ID (starting 7656119), or
// their profile's link with it in (steamcommunity.com/profiles/<ID>). Null for anything else, such as a custom link
// (steamcommunity.com/id/<name>), which does not have the ID in it.
export const readSteamId = (input) => {
  const text = String(input ?? '').trim();
  const id = /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(\d+)\/?(?:[?#].*)?$/i.exec(text)?.[1] ?? text;
  return /^7656119\d{10}$/.test(id) ? id : null;
};

// How many on the reserved list have staff spots, for its note. Nothing when none do.
export const staffNote = (staffCount, count) => {
  if (staffCount === 0) return '';
  if (staffCount === count) return count === 1 ? 'They are staff.' : 'All of them are staff.';
  return `${staffCount} of them ${staffCount === 1 ? 'is' : 'are'} staff.`;
};

// What the staff page says once a staff member has linked their Steam account: whose it is in game (`player`, null when
// the bot has not seen it there lately), or, in ?demo, that nothing was saved.
export const steamLinkedText = ({ steamId, player, sample }) => {
  if (sample) return 'Sample only: nothing was saved. Signed in, this links the account to you on the bot.';
  const counts = 'From now on, your time on the server counts as playing, not seeding.';
  if (player) return `Linked to ${player} (${steamId}). ${counts}`;
  return `Linked to ${steamId}. The bot hasn’t seen this account on our server in the last 90 days. If you play on it, that’s fine; if not, check the number and change it. ${counts}`;
};

// When a session token runs out, read from the token itself: only to stop using one that has, as the bot checks it. Null
// when it cannot be read.
export const sessionExpiry = (token) => {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const expiresAt = JSON.parse(atob(body)).expiresAt;
    return typeof expiresAt === 'number' ? expiresAt : null;
  } catch {
    return null;
  }
};

// The flags the bot puts on a player's day, worded with its marks (`flags` in its answer).
export const flagLabel = (flag) =>
  ({ teamKills: 'Team kills', sameTeammate: 'Same teammate', vehicleSuicides: 'Vehicle suicides', suicides: 'Suicides' })[flag] ?? flag;

export const flagRule = (flag, marks) =>
  ({
    teamKills: `${marks.teamKills} or more team kills in a day`,
    sameTeammate: `killed the same teammate ${marks.sameTeammate} or more times in a day`,
    vehicleSuicides: `${marks.vehicleSuicides} or more suicides in a vehicle in a day (crashing it, or blowing it up)`,
    suicides: `${marks.suicides} or more suicides of any kind in a day`,
  })[flag] ?? flag;

// What staff did, as the moderation log names it.
export const MOD_ACTIONS = {
  warn: 'Warning',
  kick: 'Kick',
  ban: 'Ban',
  unban: 'Unban',
  switchteam: 'Team move',
  'vip-add': 'VIP added',
  'vip-remove': 'VIP removed',
};

// An action as the moderation log names it, or as the bot sent it when the page has no name for it (only MOD_ACTIONS'
// own names, so an action called "toString" is not named by what every object has).
export const modActionLabel = (action) => (Object.hasOwn(MOD_ACTIONS, action) ? MOD_ACTIONS[action] : action);

// The moderation log's filter: each kind of action with how many of `entries` are that kind, every kind MOD_ACTIONS
// names (none yet is 0) in its order, then any other the bot sends.
export const modActionCounts = (entries) => {
  const counts = new Map(Object.keys(MOD_ACTIONS).map((action) => [action, 0]));
  for (const e of entries) counts.set(e.action, (counts.get(e.action) ?? 0) + 1);
  return [...counts].map(([action, count]) => ({ action, count }));
};

// A staff member as the page names them: "Sarge (@paragon)", or just the name when their username is the same.
export const staffLabel = ({ name, username }) =>
  username && username.toLowerCase() !== name.toLowerCase() ? `${name} (@${username})` : name;

// Who did it: a staff member by their name on Discord, from the bot's `staff` (by Discord user ID), else the name kept
// with the entry, else their Discord user ID; the bot itself; or someone outside the bot (in game, or in the server's
// settings), which the bot found on the server's ban list.
export const staffBy = (entry, staff = {}) => {
  if (entry.by === 'bot') return 'The bot';
  if (entry.by === 'server') return 'Outside the bot';
  const known = staff[entry.by];
  if (known) return staffLabel(known);
  return entry.byName ?? `Discord user ${entry.by}`;
};

// "3 (1 vehicle)": a count, with how many of them were with a vehicle when any were.
export const withVehicle = (count, vehicle) => (vehicle > 0 ? `${count} (${vehicle} vehicle)` : String(count));

// Risky Steam accounts: the flags the bot puts on an account, worded with its marks (`steam.flags` in its answer has
// each flag's points, `steam.marks` the days).
export const steamFlagLabel = (flag) =>
  ({
    vacBan: 'VAC ban',
    gameBan: 'Game ban',
    recentBan: 'Recent ban',
    communityBan: 'Community ban',
    tradeBan: 'Trade ban',
    newAccount: 'New account',
    youngAccount: 'Young account',
    hidden: 'Hidden profile',
  })[flag] ?? flag;

export const steamFlagRule = (flag, marks) =>
  ({
    vacBan: 'VAC bans on the account, in any game',
    gameBan: 'game bans: another game’s anti-cheat or developer banned them',
    recentBan: `the latest VAC or game ban was in the last ${marks.recentBanDays} days`,
    communityBan: 'banned from the Steam Community',
    tradeBan: 'banned from trading on Steam',
    newAccount: `made in the last ${marks.newAccountDays} days`,
    youngAccount: `made in the last ${marks.youngAccountDays} days, but not new`,
    hidden: 'the profile is private, or was never set up: Steam shows nothing about it, not even its age',
  })[flag] ?? flag;

export const RISK_LABELS = { high: 'High risk', medium: 'Worth a look' };

// "today", "12 days ago", "4 months ago", "9 years ago", as the bot words it in Discord.
export const longAgo = (at, now) => {
  const days = Math.max(0, Math.floor((now - at) / DAY));
  if (days === 0) return 'today';
  if (days < 60) return `${plural(days, 'day')} ago`;
  if (days < 730) return `${plural(Math.floor(days / 30), 'month')} ago`;
  return `${plural(Math.floor(days / 365), 'year')} ago`;
};

// What Steam says about a risky account: its bans and its profile. How old it is goes in a column of its own.
export const steamWhy = (account, now) => {
  const bans = [...(account.vacBans > 0 ? [plural(account.vacBans, 'VAC ban')] : []), ...(account.gameBans > 0 ? [plural(account.gameBans, 'game ban')] : [])];
  const last = account.lastBanAt === null ? '' : `, ${account.vacBans + account.gameBans > 1 ? 'the last ' : ''}${longAgo(account.lastBanAt, now)}`;
  return [
    ...(bans.length > 0 ? [`${bans.join(' and ')}${last}`] : []),
    ...(account.communityBanned ? ['Banned from the Steam Community'] : []),
    ...(account.tradeBan === 'banned' ? ['Banned from trading'] : []),
    ...(!account.setUp ? ['Profile never set up'] : !account.public ? ['Private profile'] : []),
  ];
};

// How old the account is, or that Steam hides it.
export const accountAge = (account, now) => (account.createdAt === null ? 'Hidden' : `Made ${longAgo(account.createdAt, now)}`);

// "62% of 230 kills", from the kill feed, or null without kills.
export const headshotShare = (kills, headshots) => (kills > 0 ? `${Math.round((headshots / kills) * 100)}% of ${kills} kills` : null);

// The staff page's Kills tab (GET /api/admin/kills).

// "26 of 35 (74%)": headshots of kills.
export const headshotCount = (kills, headshots) => (kills > 0 ? `${headshots} of ${kills} (${percent(headshots / kills)})` : '–');

// The headshots a player with the server's usual aim would get with the same weapons: "9 (26%)". The bot sends null
// while the server has too few kills to say.
export const usualHeadshots = (expected, kills) =>
  expected === null || expected === undefined || kills === 0 ? '–' : `${Math.round(expected)} (${percent(expected / kills)})`;

// Less likely than this by luck is worth saying so.
const ODDS_SHOWN = 0.05;

// The chance of that many headshots by luck: "1 in 4,800", "1 in 2.3 million". Anything likelier than 1 in 20 is
// "Ordinary"; null, when the bot can't say yet, is "–".
export const luckOdds = (chance) => {
  if (chance === null || chance === undefined) return '–';
  if (chance >= ODDS_SHOWN) return 'Ordinary';
  const n = 1 / chance;
  if (n >= 1e9) return 'Under 1 in a billion';
  if (n >= 1e6) return `1 in ${Number((n / 1e6).toPrecision(2))} million`;
  return `1 in ${Number(n.toPrecision(2)).toLocaleString('en-GB')}`;
};

// Whether a chance is unlikely enough to colour: below the flag's mark is 'bad', below 1 in 20 'hot'.
export const oddsKind = (chance, flag) => (chance === null || chance === undefined ? '' : chance * flag.odds < 1 ? 'bad' : chance < ODDS_SHOWN ? 'hot' : '');

// What gets a player's day flagged for headshots, with the bot's marks.
export const headshotRule = ({ kills, odds }) =>
  `${kills} or more kills in a day, with so many headshots that a player with the server’s usual aim, using the same weapons, would get that many less than once in ${odds.toLocaleString('en-GB')} days`;

export const flaggedDaysLabel = (days) => `Flagged ${plural(days, 'day')}`;

// Whether a player's headshots are nothing to look at: an ordinary chance by luck, and no flagged day.
export const ordinaryHeadshots = (player) => player.flaggedDays === 0 && luckOdds(player.chance) === 'Ordinary';

// One player's headshots in words, above their kills.
export const killerSummary = ({ kills, headshots, expected, chance }) => {
  if (kills === 0) return 'No kills in this period.';
  const got = `${plural(headshots, 'headshot')} in ${plural(kills, 'kill')} (${percent(headshots / kills)}).`;
  if (expected === null || expected === undefined) return `${got} The server needs more kills before headshots can be judged.`;
  const usual = ` A player with the server’s usual aim would get about ${Math.round(expected)} with the same weapons (${percent(expected / kills)}).`;
  if (chance === null || chance >= ODDS_SHOWN) return `${got}${usual} Nothing unusual.`;
  return `${got}${usual} The chance of ${headshots} or more by luck: ${luckOdds(chance)}.`;
};

// The staff page's server list (`online.players` in the bot's answer).

// Today's headshots, as a badge, when they are unlikely by luck: red once the day is flagged. An older bot sends none.
const headshotsWatch = (today) => {
  if (!today || today.chance === null || today.chance >= ODDS_SHOWN) return [];
  const usual = today.expected === null ? '' : `Usual: about ${Math.round(today.expected)}. `;
  return [
    {
      text: `${today.headshots} of ${today.kills} kills headshots today`,
      kind: today.flagged ? 'bad' : 'hot',
      title: `${usual}Chance by luck: ${luckOdds(today.chance)}.`,
    },
  ];
};

const STEAM_BADGES = { high: 'High-risk Steam account', medium: 'Steam account worth a look' };

// What is worth watching about a player in game, as badges: `kind` is 'bad', 'hot' or 'accent', or '' for a quiet one.
// `today` is the UTC day, to tell who is new.
export const watchList = (player, today) => [
  ...(player.banned ? [{ text: 'Banned', kind: 'bad' }] : []),
  ...(player.steam && player.steam.risk !== 'low'
    ? [{ text: STEAM_BADGES[player.steam.risk], kind: player.steam.risk === 'high' ? 'bad' : 'hot', title: player.steam.flags.map(steamFlagLabel).join(', ') }]
    : []),
  ...headshotsWatch(player.headshotsToday),
  ...(player.teamKillsToday > 0
    ? [{ text: `${plural(player.teamKillsToday, 'team kill')} today`, kind: player.griefFlags.length > 0 ? 'bad' : '' }]
    : []),
  ...(player.vehicleSuicidesToday > 0
    ? [{ text: `${plural(player.vehicleSuicidesToday, 'vehicle suicide')} today`, kind: player.griefFlags.includes('vehicleSuicides') ? 'hot' : '' }]
    : []),
  ...(player.firstSeen === today ? [{ text: 'New today', kind: 'accent', title: 'First time on the server in 90 days' }] : []),
  ...(player.reserved ? [{ text: 'VIP', kind: '' }] : []),
];

// Whether a player in game is worth a look now: banned, a risky Steam account, flagged for headshots or griefing today,
// or new.
export const needsLook = (player, today) =>
  player.banned ||
  (player.steam !== null && player.steam.risk !== 'low') ||
  player.headshotsToday?.flagged === true ||
  player.griefFlags.length > 0 ||
  player.firstSeen === today;

// Each team in game with how many are on it, biggest first, and players without a team (`name` null) last.
export const teamCounts = (players) => {
  const counts = new Map();
  for (const p of players) {
    const key = p.faction === null ? null : sideKey(p.faction);
    const known = counts.get(key) ?? { name: p.faction, count: 0 };
    counts.set(key, { ...known, count: known.count + 1 });
  }
  return [...counts.values()].sort((a, b) => Number(a.name === null) - Number(b.name === null) || b.count - a.count || a.name.localeCompare(b.name));
};

export const PLAYER_SORTS = {
  watch: 'Worth a look first',
  team: 'Team',
  kills: 'Most kills',
  today: 'Longest on today',
  name: 'Name',
};

// The server list as staff asked for it: names or Steam IDs containing `query`, on `team` (a sideKey, '' for every
// team, or 'none' for no team), only those worth a look when `watch`, in `sort` order: those worth a look first by
// default, so staff see them without hunting, then by team.
export const filterPlayers = (players, { query = '', team = '', watch = false, sort = 'watch' }, today) => {
  const q = query.trim().toLowerCase();
  const byName = (a, b) => a.name.localeCompare(b.name);
  const byTeam = (a, b) => Number(a.faction === null) - Number(b.faction === null) || (a.faction ?? '').localeCompare(b.faction ?? '') || byName(a, b);
  const order = {
    watch: (a, b) => Number(needsLook(b, today)) - Number(needsLook(a, today)) || byTeam(a, b),
    team: byTeam,
    kills: (a, b) => (b.kills ?? -1) - (a.kills ?? -1) || (a.deaths ?? 0) - (b.deaths ?? 0) || byName(a, b),
    today: (a, b) => b.minutesToday - a.minutesToday || byName(a, b),
    name: byName,
  };
  return players
    .filter((p) => q === '' || p.name.toLowerCase().includes(q) || p.steamId.includes(q))
    .filter((p) => team === '' || (team === 'none' ? p.faction === null : p.faction !== null && sideKey(p.faction) === team))
    .filter((p) => !watch || needsLook(p, today))
    .sort(order[sort] ?? order.watch);
};

// The live kill feed's "Only headshots" and "Only team kills": a kill shows when it is everything ticked.
export const feedKillShown = (kill, { headshots = false, teamKills = false } = {}) =>
  (!headshots || kill.headshot) && (!teamKills || kill.teamKill);

// What the live kill feed says when it has no kills, or none of them is everything ticked.
export const feedEmpty = (kills, { headshots = false, teamKills = false } = {}) =>
  kills === 0
    ? 'No kills yet.'
    : headshots && teamKills
      ? 'No team kills by headshot among them.'
      : teamKills
        ? 'No team kills among them.'
        : 'No headshots among them.';

// How many things on the Alerts tab are worth a look: risky Steam accounts and players flagged for griefing.
export const alertCount = (overview) => (overview.steam?.accounts.length ?? 0) + (overview.totals?.flaggedPlayers ?? 0);

// Admin tools: the bot's staff commands, run from the staff page. The bot sends their definitions as Discord has them
// (GET /api/admin/commands); the page builds a form for each. A command with subcommands, such as /vip, is one tool per
// subcommand, keyed "vip:add".

// The order and names the page gives the tools. A command the bot has that is not listed here goes last, under its
// own description, so a new command shows up without a change here.
export const TOOL_GROUPS = [
  {
    name: 'Players',
    tools: [
      ['player', 'Look up a player'],
      ['warn', 'Warn in game'],
      ['kick', 'Kick'],
      ['switchteam', 'Move to another team'],
      ['ban', 'Ban'],
      ['unban', 'Unban'],
    ],
  },
  { name: 'VIP', tools: [['vip:add', 'Give VIP'], ['vip:remove', 'Remove VIP'], ['seeders', 'Top seeders']] },
  {
    name: 'Server',
    tools: [
      ['broadcast', 'Message everyone in game'],
      ['setnextmap', 'Set the next map'],
      ['changemap', 'Change map now'],
      ['seednow', 'Call for seeders in Discord'],
    ],
  },
  {
    name: 'Map rotations',
    tools: [
      ['rotations:show', 'See the rotations and the week'],
      ['rotations:use', 'Swap the rotation now'],
      ['rotations:schedule', 'Pick the rotation for a day'],
      ['rotations:add', 'Add a map to a rotation'],
      ['rotations:remove', 'Take a map out of a rotation'],
      ['rotations:save', "Save the server's rotation"],
      ['rotations:delete', 'Delete a rotation'],
    ],
  },
  { name: 'Records', tools: [['removematch', 'Remove a wrongly recorded match']] },
];

// Tools that only read, so they run without asking first.
export const READ_ONLY_TOOLS = new Set(['player', 'seeders', 'rotations:show']);

const SUBCOMMAND = 1;

const describe = (text) => (text ?? '').replace(/\s*\(staff only\)\s*$/i, '');

// One tool for each command, or each subcommand, in TOOL_GROUPS order: its key, the command and subcommand to send,
// the label, what it does and its options.
export const toolsFrom = (definitions) => {
  const tools = definitions.flatMap((command) => {
    const subcommands = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
    if (subcommands.length === 0) {
      return [{ key: command.name, name: command.name, subcommand: null, description: describe(command.description), options: command.options ?? [] }];
    }
    return subcommands.map((sub) => ({
      key: `${command.name}:${sub.name}`,
      name: command.name,
      subcommand: sub.name,
      description: describe(sub.description),
      options: sub.options ?? [],
    }));
  });
  const listed = TOOL_GROUPS.flatMap((g) => g.tools.map(([key, label]) => ({ key, label, group: g.name })));
  const known = listed.flatMap(({ key, label, group }) => {
    const tool = tools.find((t) => t.key === key);
    return tool ? [{ ...tool, label, group }] : [];
  });
  const others = tools.filter((t) => !listed.some((l) => l.key === t.key)).map((t) => ({ ...t, label: t.description || `/${t.key}`, group: 'Other' }));
  return [...known, ...others];
};

// An option's label: "steam_id" and "player" are both the player; "infantry_only" is "Infantry only".
export const optionLabel = (name) =>
  name === 'steam_id' || name === 'player' ? 'Player' : name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');

// What leaving an optional option out means, from its description's "(default: …)": "As in the rotation", or
// "Off (default)" beside the On and Off it matches.
export const defaultLabel = (description) => {
  const said = /\(default: ([^)]+)\)/i.exec(description ?? '')?.[1]?.trim();
  if (!said) return 'Default';
  const label = said.charAt(0).toUpperCase() + said.slice(1);
  return /^(on|off)$/i.test(said) ? `${label} (default)` : label;
};

// Discord's markdown in a reply, as pieces to show: plain text, **bold**, `code`, [links](https://…), <t:…> times,
// <@…> users and <@&…> roles. Backslash escapes are undone.
// Escaped characters, such as \* in a player's name, never end bold or a link's text.
const DISCORD_TOKEN =
  /\*\*((?:\\.|[^*\\])+?)\*\*|`([^`]+)`|\[((?:\\.|[^\]\\])+)\]\((https?:\/\/[^)\s]+)\)|<t:(-?\d+)(?::[a-zA-Z])?>|<@!?(\d+)>|<@&(\d+)>/g;
const unescape = (text) => text.replace(/\\([\\*_~`|>#[\]()-])/g, '$1');

export const discordParts = (text) => {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(DISCORD_TOKEN)) {
    if (m.index > last) parts.push({ type: 'text', text: unescape(text.slice(last, m.index)) });
    if (m[1] !== undefined) parts.push({ type: 'strong', text: unescape(m[1]) });
    else if (m[2] !== undefined) parts.push({ type: 'code', text: m[2] });
    else if (m[3] !== undefined) parts.push({ type: 'link', text: unescape(m[3]), href: m[4] });
    else if (m[5] !== undefined) parts.push({ type: 'time', at: Number(m[5]) * 1000 });
    else if (m[6] !== undefined) parts.push({ type: 'user', id: m[6] });
    else parts.push({ type: 'role', id: m[7] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', text: unescape(text.slice(last)) });
  return parts;
};
