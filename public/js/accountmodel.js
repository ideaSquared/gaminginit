// The account page's logic and wording, with no DOM so it can be tested. A player signs in with Discord through the bot (see
// the bot's accounts.ts); the bot sends the browser back with the result after a #, and the page asks the bot for the account.

// What the bot put after the # when it sent the browser back: `#session=<token>&member=1&join=added&steam=linked`, or
// `#error=<reason>`, or `#steamproof=<proof>` from Steam. Anything else is ignored.
export const readHash = (hash) => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const found = {};
  for (const key of ['session', 'steamproof', 'error', 'member', 'join', 'steam']) {
    const value = params.get(key);
    if (value !== null && value !== '') found[key] = value;
  }
  return found;
};

// Whether the address has a result from the bot in it, for a page to take it and tidy the address.
export const hasResult = (hash) => {
  const found = readHash(hash);
  return found.session !== undefined || found.steamproof !== undefined || found.error !== undefined;
};

// The name in a player's session token, for the header, without asking the bot. The token's body is base64url of JSON in UTF-8.
export const sessionName = (token) => {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    const name = JSON.parse(new TextDecoder().decode(bytes)).name;
    return typeof name === 'string' && name !== '' ? name : null;
  } catch {
    return null;
  }
};

// A name short enough for the header.
export const shortName = (name, max = 14) => (name.length <= max ? name : `${name.slice(0, max - 1)}…`);

// Why a sign-in or a link did not work, in words.
export const errorText = (error) =>
  ({
    cancelled: 'You cancelled the sign-in. Nothing changed.',
    expired: 'That sign-in took too long, or was started in another browser. Try again.',
    failed: 'Discord or the bot could not finish the sign-in. Try again in a minute.',
    steam: 'Steam did not confirm that sign-in. Try again.',
  })[error] ?? 'Something went wrong with the sign-in. Try again in a minute.';

// What the join button did, said once after coming back from Discord. Null when it was not pressed.
export const joinText = (join) =>
  ({
    added: { kind: 'good', text: 'You are in! The bot added you to the Discord. Open it to say hello.' },
    already: { kind: 'good', text: 'You are already in the Discord.' },
    banned: { kind: 'bad', text: 'Discord would not let the bot add you to the server.' },
    unavailable: { kind: 'bad', text: 'The bot could not add you just now. Use the invite instead, then sign in again.' },
  })[join] ?? null;

// What was found of their Steam account when they signed in. Null when there is nothing to say.
export const steamText = (steam) =>
  ({
    linked: { kind: 'good', text: 'Your Steam account is linked.' },
    taken: { kind: 'bad', text: 'The Steam account on your Discord profile was linked by a staff member. Ask staff in the Discord to sort it out.' },
  })[steam] ?? null;

const dateFormat = (locale) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// "Fri 24 Oct, 18:30" in the reader's own time.
export const when = (ms, locale) => dateFormat(locale).format(new Date(ms));

// The VIP line on the account page.
export const vipText = (vip, now, locale) => {
  if (vip === null) return 'You have no VIP right now. Seed to earn it.';
  const source = vip.source === 'staff' ? 'given by staff' : 'earned by seeding';
  const days = Math.ceil((vip.until - now) / 86_400_000);
  const left = days <= 1 ? 'less than a day left' : `${days} days left`;
  return `You have VIP until ${when(vip.until, locale)} (${left}), ${source}.`;
};

// What a linked account gets here, as the bot can give it. A list of lines, each only when the bot can.
export const perkLines = (perks) => [
  ...(perks.role ? ['A role in the Discord that shows you are linked.'] : []),
  ...(perks.vipRole ? ['A VIP role in the Discord while you have seeder VIP.'] : []),
  ...(perks.messages ? ['A Discord message when your VIP is earned, nearly over or ended.'] : []),
  'Your player page and your season, one tap away.',
  'Vote for the next map right here on the website.',
];

// Whether this player can vote on the website now: signed in, in the Discord, and a vote is open.
export const canVote = (account, vote, now) =>
  account !== null && account.member === true && vote !== null && vote.open === true && now < vote.closesAt;

// What to offer someone who cannot vote yet: 'sign-in' (not signed in), 'join' (signed in, not in the Discord) or null.
export const voteOffer = (account) => {
  if (account === null) return 'sign-in';
  return account.member === true ? null : 'join';
};

// The player's choice in the open vote (a map id or condition key), or null. `ballot` is the bot's, for the vote it names.
export const choiceIn = (ballot, vote, kind) => {
  if (!ballot || !vote || ballot.poll !== vote.id) return null;
  return ballot[kind] ?? null;
};

// Where on the site a click on the Discord invite was made: the page and the part of it ("leaderboard-nav", "home-hero"), in the
// lowercase letters, digits and dashes the bot counts (at most 24 of them).
export const placeOf = (pageName, part) =>
  `${pageName}-${part ?? 'link'}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 24)
    .replace(/-+$/, '');
