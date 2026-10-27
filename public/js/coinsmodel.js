// The INITcoins page's wording and sums, with no DOM so they can be tested. The numbers come from the bot (its coins.ts, at
// /api/coins and, for a signed-in player, /api/account/coins), so the page stays right when they are changed there.

export const coinText = (n) => `${Number(n).toLocaleString('en-GB')} ${n === 1 ? 'INITcoin' : 'INITcoins'}`;

export const TIERS = ['Easy', 'Medium', 'Hard'];
export const tierLabel = (tier) => TIERS[tier] ?? 'Mission';

// How far through a mission is, 0 to 100.
export const percent = (progress, target) => (target <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((progress / target) * 100))));

// What a line in a player's log is for.
const WHY = {
  seed: 'Seeding',
  'seed-time': 'Seeding time',
  play: 'Playing',
  match: 'Match played',
  win: 'Match won',
  mission: 'Mission',
  migrate: 'Seeds before INITcoins',
  staff: 'From staff',
  buy: 'Shop',
  reroll: 'Swapped a mission',
};

export const logLine = (tx) => ({
  what: tx.note ? `${WHY[tx.why] ?? tx.why}: ${tx.note}` : (WHY[tx.why] ?? tx.why),
  delta: `${tx.delta > 0 ? '+' : tx.delta < 0 ? '−' : ''}${Math.abs(tx.delta).toLocaleString('en-GB')}`,
  gain: tx.delta > 0,
});

// "Fri 10 Oct", in the reader's own time.
export const dayText = (ms, locale) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(ms);

// The rows of "How you earn", from the bot's rates.
export const earnRows = (rates) => {
  const rows = [
    { what: 'A successful seed', pays: `${rates.seed}`, note: 'Once a day: you were on while the server seeded, and it went live.' },
  ];
  if (rates.seedMinutes.per > 0) {
    rows.push({
      what: 'Time spent seeding',
      pays: `1 per ${rates.seedMinutes.per} min`,
      note: `On top of the seed, up to ${rates.seedMinutes.cap} a day.`,
    });
  }
  if (rates.playMinutes > 0) {
    rows.push({ what: 'Playing', pays: `1 per ${rates.playMinutes} min`, note: 'While the server is live.' });
  }
  rows.push({
    what: 'A match played',
    pays: `${rates.match}`,
    note: `For your first ${rates.matchesPaid} matches of the day. Sitting in a match without playing doesn’t count.`,
  });
  rows.push({ what: 'A match won', pays: `+${rates.win}`, note: 'On top of the match, for the same matches.' });
  rows.push({
    what: 'Missions',
    pays: '10 to 80',
    note: 'Three a day and three a week. They pay on top of the limit below.',
  });
  return rows;
};

// Items by kind, in the order the shop shows them.
export const SHOP_GROUPS = [
  { kind: 'vip', title: 'Whitelist', note: 'Skip the queue when the server is full. It starts after the server’s next restart.' },
  { kind: 'title', title: 'Titles', note: 'Shown beside your name on your player page.' },
  { kind: 'role', title: 'Discord roles', note: 'Yours for good.' },
];

export const shopGroups = (shop) =>
  SHOP_GROUPS.map((group) => ({ ...group, items: shop.filter((item) => item.kind === group.kind) })).filter((group) => group.items.length > 0);

// A shop item's name without its kind, since the group says it.
export const itemName = (item) => item.name.replace(/^(Title|Discord role): /, '');

// The words on a buy button.
export const buyLabel = (item, armed) => {
  if (item.kind === 'role' && item.owned) return armed ? 'Press again to get it back' : 'Get the role again';
  if (item.owned) return 'Owned';
  return armed ? `Press again to pay ${item.price.toLocaleString('en-GB')}` : `Buy · ${item.price.toLocaleString('en-GB')}`;
};

// Whether a button is pressable: owned titles are not, and neither is anything they cannot buy.
export const canPress = (item) => !(item.owned && item.kind !== 'role') && (item.afford || (item.kind === 'role' && item.owned));

// What the page says about the whitelist they already have.
export const whitelistText = (until, now, locale) => {
  if (until === null || until <= now) return 'You have no whitelist from the bot right now.';
  const days = Math.ceil((until - now) / 86_400_000);
  return `Your whitelist runs to ${dayText(until, locale)} (${days <= 1 ? 'less than a day' : `${days} days`} left).`;
};

// How much of today’s limit playing and matches have used.
export const todayText = (today) =>
  today.earned >= today.cap
    ? `You’ve reached today’s limit for playing (${today.cap}). Seeding and missions still pay.`
    : `${today.earned} of ${today.cap} from playing today. Seeding and missions are on top.`;
