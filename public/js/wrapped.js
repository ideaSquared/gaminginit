import { kd, longestKill, metres, percent, plural, sideKey, weaponTotals } from './format.js';

// The Season in Review: the season page's slideshow, like a year in review, with jokes. One story for the whole server,
// from the bot's season roundup, and one for each player, from their player page. No DOM here, so it can be tested in
// Node: each story is a list of slides, and story.js draws them.
//
// A slide: { key, theme, emoji, kicker, big, unit, who, team, line, small, list, end }. `big` is the headline number or
// word, `unit` what comes after it, `who` a player ({ name, id }) and `team` a side ({ name, colorHex }) to name in its
// colour, `line` the joke, `small` the small print, `list` rows of { label, who, value }, and `end` marks the last slide,
// which has the buttons. `theme` picks its colours: one of THEMES, or 'team' for the team's own.
//
// The jokes roast people: that's the point, and staff chose it. They are about how people play, never who they are.

export const THEMES = ['violet', 'teal', 'blue', 'orange', 'rose', 'green', 'amber', 'fuchsia'];

const DAY = 86_400_000;

// The same joke every time for the same player and slide, but different players get different ones.
const hash = (text) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
};
export const pick = (seed, variants) => variants[hash(seed) % variants.length];

const number = (n) => Math.round(n).toLocaleString('en-GB');
const hours = (minutes) => Math.round(minutes / 60);
const matchCount = (n) => `${number(n)} match${n === 1 ? '' : 'es'}`;
const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const ofDay = (day) => dayLabel.format(Date.parse(`${day}T00:00:00Z`));
const endedLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const byScore = (scores) => [...scores].sort((a, b) => b.score - a.score);
const scoreline = (scores) => byScore(scores).map((s) => s.score).join('–');

// "Then Moth (1,127) and Sable (1,044)." from a board's second and third.
const runnersUp = (rows, value) => {
  const rest = rows.slice(1, 3).map((p) => `${p.name} (${value(p)})`);
  return rest.length === 0 ? null : `Then ${rest.join(' and ')}.`;
};

// The whole server's season, from the bot's roundup. Slides without the numbers they need are left out.
export const seasonStory = (page) => {
  const r = page.roundup;
  const name = page.name;
  const days = r.days.length;
  const slides = [];
  const add = (slide) => slides.push(slide);

  add({
    key: 'intro',
    theme: 'violet',
    emoji: '🎬',
    kicker: 'gaminginit presents',
    big: name,
    unit: r.partial ? 'so far' : 'in review',
    line: `${plural(days, 'day')}, ${matchCount(r.matches)} and a frankly worrying number of hours. Let’s see what you lot got up to.`,
    small: r.partial ? 'Staff preview: the season isn’t over yet.' : null,
  });

  if (r.matches > 0) {
    const played = hours(r.playedMs / 60_000);
    add({
      key: 'matches',
      theme: 'teal',
      emoji: '⚔️',
      kicker: 'Matches',
      big: number(r.matches),
      unit: 'matches',
      line: pick(`matches${r.matches}`, [
        `${number(played)} hours of fighting over capture points like they owe you money.`,
        `That’s ${number(played)} hours of matches. Or, as your partner calls it, “where have you been?”`,
        `${number(played)} hours of matches, and still nobody has thrown a single useful smoke.`,
      ]),
    });
  }

  add({
    key: 'players',
    theme: 'blue',
    emoji: '👥',
    kicker: 'Players',
    big: number(r.players),
    unit: 'players',
    line: pick(`players${r.players}`, [
      `${number(r.players)} of you turned up. Most of you still don’t know where the objective is.`,
      `${number(r.players)} different people joined. That’s ${number(r.players)} people who skipped the tutorial.`,
      `${number(r.players)} players. And every single one of them thinks it was their teammates’ fault.`,
    ]),
  });

  if (r.totals.minutes > 0) {
    const total = hours(r.totals.minutes);
    const years = total / (24 * 365);
    add({
      key: 'hours',
      theme: 'orange',
      emoji: '⏳',
      kicker: 'Time played',
      big: number(total),
      unit: 'hours',
      line:
        years >= 1
          ? `That’s ${years.toFixed(1)} years of your lives. Gone. No refunds.`
          : `That’s ${number(total / 24)} days, back to back. Your chairs would like a word.`,
      small: 'Everyone added up, seeding and live.',
    });
  }

  if (r.totals.kills > 0) {
    add({
      key: 'kills-total',
      theme: 'rose',
      emoji: '💥',
      kicker: 'Kills',
      big: number(r.totals.kills),
      unit: 'kills',
      line:
        r.totals.deaths > r.totals.kills
          ? `…and ${number(r.totals.deaths)} deaths. More deaths than kills. The maths doesn’t add up, and neither does your aim.`
          : `…and ${number(r.totals.deaths)} deaths. Somebody, somewhere, has been farming.`,
    });
  }

  if (r.busiestDay) {
    add({
      key: 'busiest',
      theme: 'amber',
      emoji: '📅',
      kicker: 'Busiest day',
      big: ofDay(r.busiestDay.day),
      line: `${number(r.busiestDay.players)} of you on the server in one day. Nobody went outside. Nobody.`,
    });
  }

  const best = r.bestTeam;
  if (best) {
    add({
      key: 'team',
      theme: 'team',
      emoji: '🏆',
      kicker: 'Team of the season',
      team: best,
      line: `Won ${best.wins} of ${best.matches}, ${percent(best.wins / best.matches)}. And they will not shut up about it.`,
    });
  }
  const worst = r.teams.length > 1 ? r.teams.at(-1) : null;
  if (worst && worst.name !== best?.name && worst.matches > 0) {
    const rate = percent(worst.wins / worst.matches);
    add({
      key: 'wooden-spoon',
      theme: 'team',
      emoji: '🥄',
      kicker: 'The wooden spoon',
      team: worst,
      line: pick(`spoon${worst.name}`, [
        `${worst.wins} wins out of ${worst.matches}. ${rate}. They weren’t losing, they were “strategically donating points”.`,
        `A ${rate} win rate. Even the other teams started feeling sorry for them. Briefly.`,
        `${worst.losses} losses. At some point that stops being bad luck and starts being a lifestyle.`,
      ]),
    });
  }
  if (r.streak && r.streak.wins >= 3) {
    add({
      key: 'streak',
      theme: 'team',
      emoji: '🔥',
      kicker: 'Longest winning streak',
      team: r.streak,
      big: `${r.streak.wins} in a row`,
      line: `${r.streak.wins} straight wins. Everyone else just stood around and watched it happen.`,
    });
  }

  if (r.topMap) {
    add({
      key: 'map',
      theme: 'blue',
      emoji: '🗺️',
      kicker: 'Played most',
      big: r.topMap.map,
      line: `${r.topMap.matches} matches on ${r.topMap.map}. The rotation has favourites and it isn’t even subtle.`,
    });
  }

  const [killer] = r.kills;
  if (killer) {
    add({
      key: 'most-kills',
      theme: 'teal',
      emoji: '🔫',
      kicker: 'Most kills',
      who: killer,
      big: number(killer.kills),
      unit: 'kills',
      line: pick(`kills${killer.name}`, [
        `Somebody check ${killer.name}’s PC. Then check it again.`,
        `The enemy team has a group chat about ${killer.name}. It isn’t nice.`,
        `At this point it isn’t a game for ${killer.name}, it’s pest control.`,
      ]),
      small: runnersUp(r.kills, (p) => number(p.kills)),
    });
  }

  const [sharp] = r.kd;
  if (sharp) {
    add({
      key: 'best-kd',
      theme: 'violet',
      emoji: '🎯',
      kicker: 'Best K/D',
      who: sharp,
      big: sharp.kd.toFixed(2),
      unit: 'K/D',
      line: pick(`kd${sharp.name}`, [
        `${sharp.name} died so rarely the respawn screen forgot what they look like.`,
        `Either cracked or camping. ${sharp.name} isn’t saying which.`,
      ]),
      small: `From ${plural(r.kdMinHours, 'hour')} played.`,
    });
  }

  const [rampage] = r.bestMatch;
  if (rampage) {
    add({
      key: 'best-match',
      theme: 'orange',
      emoji: '💣',
      kicker: 'Most kills in a match',
      who: rampage,
      big: String(rampage.kills),
      unit: 'kills in one match',
      line: `On ${rampage.map}, against ${plural(rampage.deaths, 'death')}. That isn’t a match, that’s a crime scene.`,
    });
  }

  const [mvp] = r.mvps;
  if (mvp && mvp.mvps > 1) {
    add({
      key: 'mvps',
      theme: 'amber',
      emoji: '⭐',
      kicker: 'Most MVPs',
      who: mvp,
      big: String(mvp.mvps),
      unit: 'MVPs',
      line: `Top of the scoreboard ${mvp.mvps} times. ${mvp.name} has mentioned it roughly ${mvp.mvps * 10} times.`,
    });
  }

  const [grinder] = r.playtime;
  if (grinder) {
    const played = hours(grinder.minutes);
    const perDay = grinder.minutes / 60 / Math.max(days, 1);
    add({
      key: 'playtime',
      theme: 'rose',
      emoji: '🪑',
      kicker: 'Most time played',
      who: grinder,
      big: number(played),
      unit: 'hours',
      line:
        perDay >= 4
          ? `That’s ${perDay.toFixed(1)} hours a day, every day. ${grinder.name}, blink twice if you need help.`
          : pick(`playtime${grinder.name}`, [
              `Grass is green, ${grinder.name}. Just so you know. For reference.`,
              `${grinder.name}’s chair has a permanent imprint now. It’s load-bearing.`,
            ]),
    });
  }

  const [seeder] = r.seeding;
  if (seeder) {
    add({
      key: 'seeding',
      theme: 'green',
      emoji: '🌱',
      kicker: 'Top seeder',
      who: seeder,
      big: String(seeder.seedDays),
      unit: seeder.seedDays === 1 ? 'seed day' : 'seed days',
      line: `Sat on an empty server so the rest of you didn’t have to. Hero. Slightly odd. But a hero.`,
    });
  }

  const [corpse] = r.deaths ?? [];
  if (corpse) {
    add({
      key: 'most-deaths',
      theme: 'fuchsia',
      emoji: '💀',
      kicker: 'Most deaths',
      who: corpse,
      big: number(corpse.deaths),
      unit: 'deaths',
      line: pick(`deaths${corpse.name}`, [
        `The respawn button has filed for a restraining order against ${corpse.name}.`,
        `${corpse.name} is the main reason the other team had a good season.`,
        `${corpse.name} wasn’t playing the game so much as donating to it.`,
      ]),
      small: `${number(corpse.kills)} kills too, to be fair. Bless.`,
    });
  }

  const [traitor] = r.teamKills ?? [];
  if (traitor) {
    add({
      key: 'friendly-fire',
      theme: 'amber',
      emoji: '🤦',
      kicker: 'The friendly fire award',
      who: traitor,
      big: String(traitor.teamKills),
      unit: traitor.teamKills === 1 ? 'team kill' : 'team kills',
      line: pick(`teamkills${traitor.name}`, [
        `${traitor.name} killed their own side ${traitor.teamKills} times. Whose team are you on?`,
        `${traitor.name} doesn’t have teammates. Only targets with the same badge.`,
      ]),
    });
  }

  const a = r.awards;
  const roles = (a?.roles ?? []).filter((role) => role.top.length > 0);
  if (roles.length > 0) {
    add({
      key: 'roles',
      theme: 'blue',
      emoji: '🎖️',
      kicker: 'The specialists',
      big: 'Role awards',
      list: roles.map((role) => ({ label: ROLE_NAMES[role.role] ?? role.role, who: role.top[0], value: `${number(role.top[0].kills)} kills` })),
      line: 'The best at each job, by kills with its weapons.',
    });
  }
  if (a?.longest) {
    add({
      key: 'longest-shot',
      theme: 'teal',
      emoji: '📏',
      kicker: 'Longest shot',
      who: a.longest,
      big: metres(a.longest.distance),
      unit: `with the ${a.longest.weapon}`,
      line: 'The bullet had time to stop for a cup of tea on the way.',
    });
  }
  if (a?.roadKills) {
    add({
      key: 'road-rage',
      theme: 'orange',
      emoji: '🚗',
      kicker: 'Road rage',
      who: a.roadKills,
      big: String(a.roadKills.kills),
      unit: 'run over or blown up',
      line: `${a.roadKills.name}’s driving licence has been revoked. Again.`,
    });
  }
  if (a?.melee) {
    add({
      key: 'bonk',
      theme: 'violet',
      emoji: '🔨',
      kicker: 'Bonk',
      who: a.melee,
      big: String(a.melee.kills),
      unit: a.melee.kills === 1 ? 'melee kill' : 'melee kills',
      line: `${a.melee.name} brought a hammer to a gunfight. And won.`,
    });
  }
  const mentions = [
    a?.headshots && { label: 'Headhunter', who: a.headshots, value: plural(a.headshots.headshots, 'headshot') },
    a?.sidearm && { label: 'Quickdraw', who: a.sidearm, value: plural(a.sidearm.kills, 'pistol kill') },
    a?.variety && { label: 'Jack of all trades', who: a.variety, value: `kills with ${plural(a.variety.weapons, 'weapon')}` },
    r.regular && { label: 'Ever-present', who: r.regular, value: `on ${r.regular.days} of ${plural(r.regular.of, 'day')}` },
    r.rookie && { label: 'Rookie of the season', who: r.rookie, value: `${number(hours(r.rookie.minutes))} hours` },
  ].filter(Boolean);
  if (mentions.length > 0) {
    add({ key: 'mentions', theme: 'rose', emoji: '🌟', kicker: 'Honourable mentions', big: 'Shout-outs', list: mentions, line: 'Because everyone deserves a participation medal. Nearly everyone.' });
  }

  const [gun] = r.weapons?.top ?? [];
  if (gun) {
    add({
      key: 'weapon',
      theme: 'green',
      emoji: '🔫',
      kicker: 'Weapon of the season',
      big: gun.name,
      unit: `${number(gun.kills)} kills`,
      line: `The ${gun.name} did more work this season than most of you.`,
      small: `${percent(gun.kills > 0 ? gun.headshots / gun.kills : null)} of them headshots.`,
    });
  }

  if (r.closestMatch) {
    const [, second] = byScore(r.closestMatch.factionScores);
    add({
      key: 'closest',
      theme: 'amber',
      emoji: '😬',
      kicker: `Closest finish · ${r.closestMatch.map}`,
      big: scoreline(r.closestMatch.factionScores),
      line: second ? `So close. ${second.name} will be thinking about this one until Season 3.` : 'So, so close.',
    });
  }
  if (r.biggestWin) {
    const [first] = byScore(r.biggestWin.factionScores);
    add({
      key: 'biggest',
      theme: 'rose',
      emoji: '🧹',
      kicker: `Biggest win · ${r.biggestWin.map}`,
      big: scoreline(r.biggestWin.factionScores),
      line: first ? `${first.name} didn’t win on ${r.biggestWin.map}. They evicted everyone.` : 'Not a contest.',
    });
  }

  add({
    key: 'outro',
    theme: 'violet',
    emoji: '👋',
    kicker: r.partial ? `${name}, so far` : `That’s ${name}`,
    big: r.partial ? 'To be continued' : 'GG',
    line: r.partial
      ? 'The season isn’t over yet. Plenty of time for more terrible decisions.'
      : 'Thanks for playing, seeding and point-blank refusing to play the objective. See you in Season 2.',
    end: true,
  });
  return slides;
};

const ROLE_NAMES = {
  assault: 'Assault',
  support: 'Support',
  'machine-gun': 'Machine gunner',
  marksman: 'Marksman',
  demolition: 'Demolitions',
  'vehicle-gun': 'Vehicle crew',
};

// One player's season, from their player page (GET /api/player): their days, matches and weapons from `start` up to,
// not including, `end`. A player page covers the last 90 days, so a season further back than that is cut short.
export const playerSeason = (profile, start, end) => {
  const first = new Date(start).toISOString().slice(0, 10);
  const last = new Date(end - 1).toISOString().slice(0, 10);
  const days = profile.activity.filter((d) => d.day >= first && d.day <= last);
  const matches = profile.matches.filter((m) => m.endedAt >= start && m.endedAt < end);
  const sum = (list, value) => list.reduce((total, item) => total + value(item), 0);
  const played = days.filter((d) => d.seedingMinutes + d.liveMinutes > 0);
  const decided = matches.filter((m) => m.result === 'won' || m.result === 'lost');
  const best = matches.reduce((top, m) => (top === null || m.kills > top.kills || (m.kills === top.kills && m.deaths < top.deaths) ? m : top), null);
  const count = (key) => {
    const counts = new Map();
    for (const m of matches) {
      const value = key(m);
      if (value) counts.set(sideKey(value), { name: value, matches: (counts.get(sideKey(value))?.matches ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name))[0] ?? null;
  };
  const weapons = profile.weapons ? weaponTotals(profile.weapons.used.filter((w) => w.day <= last), first) : [];
  const covers = utcDayOf(profile.generatedAt - (profile.days - 1) * DAY);
  return {
    name: profile.name,
    id: profile.id,
    minutes: sum(days, (d) => d.seedingMinutes + d.liveMinutes),
    days: played.length,
    seedDays: sum(days, (d) => d.seedDays),
    kills: sum(days, (d) => d.kills),
    deaths: sum(days, (d) => d.deaths),
    matches: matches.length,
    wins: decided.filter((m) => m.result === 'won').length,
    decided: decided.length,
    mvps: matches.filter((m) => m.place === 1).length,
    best: best && best.kills > 0 ? { kills: best.kills, deaths: best.deaths, map: best.map, endedAt: best.endedAt } : null,
    map: count((m) => m.map),
    side: count((m) => m.faction),
    weapon: weapons[0] ?? null,
    longest: longestKill(weapons),
    // The first day of the season their page no longer has, when it is too far back.
    cutFrom: covers > first ? covers : null,
  };
};

const utcDayOf = (at) => new Date(at).toISOString().slice(0, 10);

// Where a player is on the season's top-10 boards, best place first.
export const hallOfFame = (roundup, id) => {
  const boards = [
    ['kills', 'most kills'],
    ['kd', 'best K/D'],
    ['bestMatch', 'most kills in a match'],
    ['wins', 'most wins'],
    ['mvps', 'most MVPs'],
    ['playtime', 'most time played'],
    ['seeding', 'top seeders'],
    ['deaths', 'most deaths'],
    ['teamKills', 'most team kills'],
  ];
  return boards
    .flatMap(([key, title]) => {
      const place = (roundup[key] ?? []).findIndex((p) => p.id === id);
      return place === -1 ? [] : [{ key, title, place: place + 1 }];
    })
    .sort((a, b) => a.place - b.place);
};

// One player's story. `seasonDays` is how many days the season has.
export const playerStory = (stats, page, seasonDays) => {
  const r = page.roundup;
  const name = stats.name;
  const slides = [];
  const add = (slide) => slides.push(slide);
  const seed = (key) => `${key}${stats.id}`;

  add({
    key: 'you-intro',
    theme: 'violet',
    emoji: '🪞',
    kicker: `${page.name} in review`,
    big: name,
    line: pick(seed('intro'), [`Right then, ${name}. Let’s see the damage.`, `${name}’s season. Brace yourself.`, `Sit down, ${name}. This might sting a bit.`]),
    small: stats.cutFrom ? `Your player page only goes back to ${ofDay(stats.cutFrom)}, so your season starts there.` : null,
  });

  if (stats.minutes === 0) {
    add({
      key: 'you-absent',
      theme: 'rose',
      emoji: '👻',
      kicker: 'Time played',
      big: '0',
      unit: 'hours',
      line: `You didn’t play a minute of ${page.name}. Bold strategy. Can’t lose if you don’t play.`,
    });
    add({ key: 'you-outro', theme: 'violet', emoji: '👋', kicker: 'That was your season', big: 'Was it?', line: 'See you in Season 2. Maybe.', end: true });
    return slides;
  }

  const played = stats.minutes / 60;
  add({
    key: 'you-time',
    theme: 'orange',
    emoji: '⏳',
    kicker: 'Time played',
    big: played >= 1 ? number(played) : String(Math.round(stats.minutes)),
    unit: played >= 1 ? (Math.round(played) === 1 ? 'hour' : 'hours') : 'minutes',
    line:
      played >= 100
        ? `On ${stats.days} of ${plural(seasonDays, 'day')}. Your chair has a permanent imprint of you now.`
        : played >= 30
          ? `On ${stats.days} of ${plural(seasonDays, 'day')}. Respectable. Slightly concerning. Respectable.`
          : played >= 5
            ? `On ${stats.days} of ${plural(seasonDays, 'day')}. A weekend warrior, with the emphasis on weekend.`
            : `On ${stats.days} of ${plural(seasonDays, 'day')}. Blink and we missed you. So did the enemy.`,
  });

  if (stats.decided > 0) {
    const rate = stats.wins / stats.decided;
    add({
      key: 'you-wins',
      theme: 'teal',
      emoji: '🏅',
      kicker: 'Wins',
      big: String(stats.wins),
      unit: `of ${matchCount(stats.decided)} won`,
      line:
        rate >= 0.6
          ? `${percent(rate)}. Carrying, or just lucky with your teams? We’ll never tell.`
          : rate >= 0.4
            ? `${percent(rate)}. Perfectly average. The beige of win rates.`
            : `${percent(rate)}. You’re the reason the other team had such a good season.`,
    });
  }

  const ratio = stats.kills / Math.max(stats.deaths, 1);
  add({
    key: 'you-kills',
    theme: 'rose',
    emoji: '💥',
    kicker: 'Kills',
    big: number(stats.kills),
    unit: stats.kills === 1 ? 'kill' : 'kills',
    line:
      stats.kills === 0
        ? 'Zero kills. A true pacifist. Or very, very lost.'
        : ratio >= 2
          ? `K/D ${kd(stats.kills, stats.deaths)}. Suspiciously good. We’re keeping an eye on you.`
          : ratio >= 1
            ? `K/D ${kd(stats.kills, stats.deaths)}. More kills than deaths. Your mum would be proud. Probably.`
            : `K/D ${kd(stats.kills, stats.deaths)}. More deaths than kills. You’re basically a walking respawn tutorial.`,
    small: `${number(stats.deaths)} deaths.`,
  });

  if (stats.best) {
    add({
      key: 'you-best',
      theme: 'amber',
      emoji: '🌋',
      kicker: 'Your best match',
      big: String(stats.best.kills),
      unit: 'kills',
      line: `On ${stats.best.map}, ${endedLabel.format(stats.best.endedAt)}. Peak you. It’s all been downhill since.`,
      small: stats.mvps > 0 ? `Top of the scoreboard ${plural(stats.mvps, 'time')} this season.` : null,
    });
  }

  if (stats.weapon) {
    const w = stats.weapon;
    add({
      key: 'you-weapon',
      theme: 'green',
      emoji: '❤️',
      kicker: 'Your weapon',
      big: w.name,
      unit: `${number(w.kills)} kills`,
      line: `${percent(w.kills > 0 ? w.headshots / w.kills : null)} of them headshots. You and the ${w.name}: a love story.`,
      small: stats.longest ? `Longest kill: ${metres(stats.longest.distance)} with the ${stats.longest.weapon}.` : null,
    });
  }

  if (stats.map) {
    add({
      key: 'you-map',
      theme: 'blue',
      emoji: '🗺️',
      kicker: 'Your map',
      big: stats.map.name,
      unit: matchCount(stats.map.matches),
      line: stats.side
        ? `And ${stats.side.matches} for ${stats.side.name}. A creature of habit.`
        : 'A creature of habit.',
    });
  }

  add({
    key: 'you-seeding',
    theme: 'green',
    emoji: '🌱',
    kicker: 'Seeding',
    big: String(stats.seedDays),
    unit: stats.seedDays === 1 ? 'seed day' : 'seed days',
    line:
      stats.seedDays > 0
        ? `You got the server going on ${plural(stats.seedDays, 'day')}. Actual hero. We owe you one.`
        : 'Zero. The server doesn’t fill itself, you know. Season 2 is your chance.',
  });

  const fame = hallOfFame(r, stats.id);
  const [top] = fame;
  add({
    key: 'you-fame',
    theme: top ? 'fuchsia' : 'rose',
    emoji: top ? (top.key === 'deaths' || top.key === 'teamKills' ? '🫣' : '🏆') : '🪦',
    kicker: 'The hall of fame',
    big: top ? `#${top.place}` : 'Nowhere',
    unit: top ? `for ${top.title}` : null,
    line: top
      ? top.key === 'deaths' || top.key === 'teamKills'
        ? 'You made a top 10. Just maybe not the one you wanted.'
        : 'Frame it. Put it on the wall. Tell everyone.'
      : 'Not one top 10. Plenty of room at the bottom, though.',
    // The next three places they hold, so the slide still fits a phone.
    list: fame.slice(1, 4).map((f) => ({ label: `#${f.place}`, value: f.title })),
  });

  add({
    key: 'you-outro',
    theme: 'violet',
    emoji: '👋',
    kicker: `That was your ${page.name}`,
    big: 'GG',
    line: pick(seed('outro'), ['Same again in Season 2? Maybe aim this time.', 'See you in Season 2. Bring snacks. And a better K/D.']),
    end: true,
  });
  return slides;
};
