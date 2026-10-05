import { activityCalendar, formChart } from './charts.js';
import {
  bests,
  byMap,
  bySide,
  calendarWeeks,
  clockHour,
  daysAgo,
  formatDuration,
  formatHours,
  HEAT_STEPS,
  inPeriod,
  kd,
  longestKill,
  metres,
  ordinal,
  percent,
  played,
  results,
  seedProgress,
  sideColours,
  sideKey,
  streaks,
  sumDays,
  topRanks,
  utcDay,
  WEAPON_KINDS,
  weaponTotals,
} from './format.js';
import { demoProfile } from './demo.js';
import { apiUrl, startLive } from './live.js';
import { el, mapTag, setText, sideName } from './views.js';

// A player's page: their numbers over the last 30 or 90 days, their days on the server, and their matches.

const DAY = 86_400_000;
const CALENDAR_WEEKS = 13;
// The kills chart shows this many of their latest matches.
const FORM_MATCHES = 20;
// The match list shows this many at first, and this many more each time "Show more" is pressed.
const MATCHES_SHOWN = 10;
// Their weapons with the most kills, this many.
const WEAPONS_SHOWN = 8;

const $ = (id) => document.getElementById(id);

const id = new URLSearchParams(location.search).get('id') ?? '';

// The reader's own time for matches; UTC for days, like the bot's records.
const ended = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: clockHour(), minute: '2-digit' });
const dayLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateLong = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const ofDay = (day) => dayLong.format(Date.parse(`${day}T00:00:00Z`));

let profile = null;
let period = 30;
let shown = MATCHES_SHOWN;

const calendar = activityCalendar($('calendar'));
const form = formChart($('form-chart'));

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

const tableOf = (table, headings, rows) => {
  table.replaceChildren(
    el('thead', {}, el('tr', {}, ...headings.map((h) => el('th', { scope: 'col', textContent: h })))),
    el('tbody', {}, ...rows.map((row) => el('tr', {}, ...row.map((cell) => el('td', {}, cell))))),
  );
};

const showMissing = (title, text) => {
  $('player-body').hidden = true;
  $('player-online').hidden = true;
  $('player-missing').hidden = false;
  setText($('missing-title'), title);
  setText($('missing-text'), text);
  setText($('player-name'), 'Player');
  $('player-chips').replaceChildren();
  setText($('player-sub'), '');
};

const renderHead = (now) => {
  const today = utcDay(now);
  const last = profile.activity.at(-1);
  document.title = `${profile.name} | Players | gaminginit WARDOGS server`;
  setText($('player-name'), profile.name);
  // The first letter or number in their name, for the badge beside it.
  setText($('player-avatar'), (profile.name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase());
  const daysOn = profile.activity.length;
  setText(
    $('player-sub'),
    [
      profile.online ? 'In game now' : last ? `Last played: ${daysAgo(last.day, today).toLowerCase()}` : null,
      `on our server ${plural(daysOn, 'day')} of the last ${profile.days}`,
    ]
      .filter(Boolean)
      .join(' · '),
  );

  const mvps = bests(profile.matches, profile.activity).mvps;
  $('player-chips').replaceChildren(
    ...[
      profile.online ? el('li', { className: 'chip chip-online' }, el('span', { className: 'online-dot', ariaHidden: 'true' }), 'In game now') : null,
      profile.vip ? el('li', { className: 'chip chip-vip', textContent: `VIP until ${dateLong.format(profile.vip.until)}` }) : null,
      ...topRanks(profile.ranks).map((rank) => el('li', { className: 'chip chip-rank', title: `Last ${profile.ranks.days} days`, textContent: rank.text })),
      mvps > 0 ? el('li', { className: 'chip', title: 'Most kills in the match', textContent: `MVP ${mvps}×` }) : null,
    ].filter(Boolean),
  );

  const online = profile.online;
  $('player-online').hidden = !online;
  if (online) {
    $('player-online').replaceChildren(
      el('span', { className: 'online-dot', ariaHidden: 'true' }),
      el('strong', { textContent: 'In game now' }),
      mapTag(online.map),
      online.faction ? sideName(online.faction, sideColours(profile.matches), 'side side-mine') : null,
      el('span', { className: 'muted', textContent: `${plural(online.kills, 'kill')}, ${plural(online.deaths, 'death')} this match` }),
    );
  }
};

const tile = (label, value, sub) =>
  el('div', { className: 'tile' }, el('p', { className: 'tile-label', textContent: label }), el('p', { className: 'tile-value', textContent: value }), el('p', { className: 'tile-sub', textContent: sub }));

// "#3 of 214", for the 30 days the leaderboard covers.
const place = (key) => {
  const rank = profile.ranks?.[key];
  return period === profile.ranks?.days && rank ? `#${rank} of ${profile.ranks.players}` : null;
};

const subline = (...parts) => parts.filter(Boolean).join(' · ');

const renderStats = (now) => {
  const { activity, matches } = inPeriod(profile, period, now);
  const totals = sumDays(activity);
  const record = results(matches);
  const best = bests(matches, activity);
  const first = utcDay(now - (period - 1) * DAY);
  const weapons = profile.weapons ? weaponTotals(profile.weapons.used, first) : [];
  const longest = longestKill(weapons);
  setText(
    $('period-note'),
    period === profile.ranks?.days
      ? `The last ${period} days on our server (UTC days). Places are out of everyone who played, by the leaderboard’s rules.`
      : `The last ${period} days on our server (UTC days).`,
  );
  for (const button of document.querySelectorAll('.period button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.days) === period));
  }

  const kdRank = place('kd');
  const kdNote = period === profile.ranks?.days && !kdRank && totals.kills > 0 ? `${profile.ranks.kdMinMatches}+ matches to be placed` : null;
  $('player-tiles').replaceChildren(
    tile('Time played', formatHours(played(totals)), subline(place('playtime'), plural(totals.days, 'day'))),
    tile('Matches', String(totals.matches), subline(best.podiums > 0 ? `top 3 in ${best.podiums}` : null)),
    tile('Kills', String(totals.kills), subline(place('kills'), totals.matches > 0 ? `${(totals.kills / totals.matches).toFixed(1)} a match` : null)),
    tile('K/D', totals.kills + totals.deaths > 0 ? kd(totals.kills, totals.deaths) : '–', subline(kdRank ?? kdNote, plural(totals.deaths, 'death'))),
    tile('Win rate', percent(record.share), record.decided > 0 ? subline(`${record.won} won`, `${record.lost} lost`, record.draw > 0 ? `${record.draw} drawn` : null) : 'No sides recorded yet'),
    tile('Seed days', String(totals.seedDays), subline(place('seeding'), `${formatHours(totals.seedingMinutes)} seeding`)),
  );

  const entries = [
    best.kills && ['Most kills in a match', String(best.kills.kills), `${best.kills.map} · ${dateLong.format(best.kills.endedAt)}`],
    best.kd && ['Best K/D in a match', kd(best.kd.kills, best.kd.deaths), `${best.kd.kills} kills, ${plural(best.kd.deaths, 'death')} · ${best.kd.map}`],
    best.day && ['Most kills in a day', String(best.day.kills), `${ofDay(best.day.day)} (UTC) · ${plural(best.day.matches, 'match', 'matches')}`],
    longest && ['Longest kill', metres(longest.distance), `With the ${longest.weapon}`],
    ['MVP', plural(best.mvps, 'time'), 'Most kills in the match'],
    ['Top 3 finishes', String(best.podiums), matches.length > 0 ? `of ${plural(matches.length, 'match', 'matches')}` : 'No matches yet'],
  ].filter(Boolean);
  $('player-bests').replaceChildren(
    ...entries.flatMap(([label, value, note]) => [
      el('dt', { textContent: label }),
      el('dd', {}, el('strong', { textContent: value }), el('span', { className: 'muted', textContent: note })),
    ]),
  );

  renderWeapons(weapons, first);

  const maps = byMap(matches);
  $('player-maps').replaceChildren(
    maps.length === 0
      ? el('p', { className: 'muted', textContent: 'No matches in this time.' })
      : el(
          'table',
          { className: 'players-table stat-table' },
          el('thead', {}, el('tr', {}, ...['Map', 'Matches', 'Win rate', 'K/D', 'Best'].map((h) => el('th', { scope: 'col', textContent: h })))),
          el(
            'tbody',
            {},
            ...maps.map((m) =>
              el(
                'tr',
                {},
                el('td', {}, mapTag(m.map)),
                el('td', { textContent: String(m.matches) }),
                el('td', { textContent: percent(m.share) }),
                el('td', { textContent: kd(m.kills, m.deaths) }),
                el('td', { textContent: m.best ? `${m.best.kills} kills` : '–' }),
              ),
            ),
          ),
        ),
  );

  const sides = bySide(matches);
  const colours = sideColours(profile.matches);
  $('player-sides').replaceChildren(
    sides.length === 0
      ? el('p', { className: 'muted', textContent: matches.length === 0 ? 'No matches in this time.' : 'The bot records which side players are on from now on.' })
      : el(
          'table',
          { className: 'players-table stat-table' },
          el('thead', {}, el('tr', {}, ...['Side', 'Matches', 'Won', 'Win rate'].map((h) => el('th', { scope: 'col', textContent: h })))),
          el(
            'tbody',
            {},
            ...sides.map((s) =>
              el(
                'tr',
                {},
                el('td', {}, sideName(s.faction, colours, 'side side-mine')),
                el('td', { textContent: String(s.matches) }),
                el('td', { textContent: String(s.won) }),
                el('td', { textContent: percent(s.share) }),
              ),
            ),
          ),
        ),
  );
};

// Their weapons over the period, from the game's kill feed. Only when the bot has the feed.
const renderWeapons = (weapons, first) => {
  $('weapons-panel').hidden = !profile.weapons;
  if (!profile.weapons) return;
  const since = profile.weapons.since;
  $('weapons-since').hidden = since <= first;
  setText($('weapons-since'), `Since ${ofDay(since)}, when our bot started reading the game’s kill feed.`);
  if (weapons.length === 0) {
    $('player-weapons').replaceChildren(el('p', { className: 'muted', textContent: 'No kills recorded in this time.' }));
    return;
  }
  const most = weapons[0].kills;
  const shown = weapons.slice(0, WEAPONS_SHOWN);
  $('player-weapons').replaceChildren(
    ...[
      el(
      'table',
      { className: 'players-table stat-table' },
      el('thead', {}, el('tr', {}, ...['Weapon', 'Kills', 'Headshots', 'Longest'].map((h) => el('th', { scope: 'col', textContent: h })))),
      el(
        'tbody',
        {},
        ...shown.map((w) => {
          const bar = el('span', { className: 'weapon-bar', ariaHidden: 'true' });
          bar.style.setProperty('--share', String(w.kills / most));
          return el(
            'tr',
            {},
            el(
              'td',
              {},
              el('span', { className: 'weapon-name' }, w.name, WEAPON_KINDS[w.kind] ? el('span', { className: 'kind-tag', textContent: WEAPON_KINDS[w.kind] }) : null),
              bar,
            ),
            el('td', { textContent: String(w.kills) }),
            el('td', { textContent: percent(w.headshots / w.kills) }),
            el('td', { textContent: w.longest === null ? '–' : metres(w.longest) }),
          );
        }),
      ),
    ),
      weapons.length > shown.length
        ? el('p', { className: 'weapons-more', textContent: `And ${plural(weapons.length - shown.length, 'more weapon')}.` })
        : null,
    ].filter(Boolean),
  );
};

const renderSeeding = () => {
  const seeding = profile.seeding;
  $('seed-panel').hidden = !seeding && !profile.vip;
  $('vip-status').hidden = !profile.vip;
  if (profile.vip) setText($('vip-status'), `Has a reserved slot until ${dateLong.format(profile.vip.until)}.`);
  if (!seeding) {
    $('seed-pips').replaceChildren();
    setText($('seed-progress'), '');
    return;
  }
  const { rule, seedDays } = seeding;
  $('seed-pips').replaceChildren(
    ...Array.from({ length: rule.seedDays }, (_, i) => el('span', { className: i < seedDays ? 'pip pip-on' : 'pip' })),
  );
  setText($('seed-progress'), seedProgress(seeding, profile.vip !== null));
};

// Every side's score, highest first, each name in its own colour: "Valkyra 100 · Lonestar 72 · Manticore 41". Their own
// side is in bold.
const scoreList = (match) => {
  const colours = sideColours([match]);
  const scores = [...match.factionScores].sort((a, b) => b.score - a.score);
  const mine = match.faction ? sideKey(match.faction) : null;
  return el(
    'span',
    { className: 'scores' },
    ...scores.flatMap((s, i) => [
      i > 0 ? el('span', { className: 'muted', textContent: ' · ' }) : null,
      sideName(s.name, colours, sideKey(s.name) === mine ? 'side side-mine' : 'side'),
      ` ${s.score}`,
    ]),
  );
};

const RESULT_LABELS = { won: 'Won', lost: 'Lost', draw: 'Draw' };

const renderMatches = () => {
  const list = $('player-matches');
  const matches = profile.matches;
  if (matches.length === 0) {
    list.replaceChildren(el('li', { className: 'muted', textContent: 'No matches in the last 90 days. A match counts once the server has gone live.' }));
    $('more-matches').hidden = true;
    return;
  }
  list.replaceChildren(
    ...matches.slice(0, shown).map((m) =>
      el(
        'li',
        { className: 'match-row pm-row' },
        el(
          'div',
          { className: 'pm-main' },
          el(
            'p',
            { className: 'match-headline' },
            mapTag(m.map),
            m.result ? el('span', { className: `result result-${m.result}`, textContent: RESULT_LABELS[m.result] }) : null,
            m.factionScores.length > 0 ? scoreList(m) : el('span', { className: 'muted', textContent: 'No score recorded' }),
          ),
          el('p', { className: 'match-meta', textContent: [m.faction ? `As ${m.faction}` : null, ended.format(m.endedAt), formatDuration(m.durationMs)].filter(Boolean).join(' · ') }),
        ),
        el(
          'p',
          { className: 'pm-score' },
          el('strong', { textContent: String(m.kills) }),
          m.kills === 1 ? ' kill · ' : ' kills · ',
          el('strong', { textContent: String(m.deaths) }),
          m.deaths === 1 ? ' death' : ' deaths',
          el('span', { className: 'pm-place', textContent: m.place === 1 && m.kills > 0 ? `MVP · 1st of ${m.players}` : `${ordinal(m.place)} of ${m.players}` }),
        ),
      ),
    ),
  );
  $('more-matches').hidden = shown >= matches.length;
  setText($('more-matches'), `Show more (${matches.length - shown} left)`);
};

const renderActivity = (now) => {
  const today = utcDay(now);
  const byDay = new Map(profile.activity.map((d) => [d.day, d]));
  const first = utcDay(now - (profile.days - 1) * DAY);
  calendar.update({ weeks: calendarWeeks(today, CALENDAR_WEEKS, first), byDay });
  const { current, longest } = streaks(profile.activity, today);
  $('player-streaks').replaceChildren(
    el('span', {}, el('strong', { textContent: plural(profile.activity.length, 'day') }), ' on the server'),
    el('span', {}, el('strong', { textContent: plural(longest, 'day') }), ' longest streak'),
    el('span', {}, el('strong', { textContent: plural(current, 'day') }), ' current streak'),
  );
  tableOf(
    $('calendar-table'),
    ['Day (UTC)', 'Time played', 'Matches', 'Kills', 'Seed day'],
    [...profile.activity].reverse().map((d) => [ofDay(d.day), formatHours(played(d)), String(d.matches), String(d.kills), d.seedDays > 0 ? 'Yes' : '']),
  );

  const latest = profile.matches.slice(0, FORM_MATCHES).reverse();
  form.update({ matches: latest });
  setText($('form-sub'), `Their last ${plural(latest.length, 'match', 'matches')}, oldest first. Under each: W won, L lost, D draw.`);
  tableOf(
    $('form-table'),
    ['Ended', 'Map', 'Kills', 'Deaths', 'Result', 'Place'],
    latest.map((m) => [ended.format(m.endedAt), m.map, String(m.kills), String(m.deaths), m.result ?? '–', `${ordinal(m.place)} of ${m.players}`]),
  );
};

// The legend names every shade, so the calendar never relies on colour alone.
const renderLegend = () => {
  const time = (minutes) => (minutes < 60 ? `${minutes} min` : `${Number((minutes / 60).toFixed(1))} h`);
  const labels = ['Not on', ...HEAT_STEPS.map((step) => `Under ${time(step)}`), `${time(HEAT_STEPS.at(-1))}+`];
  $('heat-legend').replaceChildren(
    ...labels.map((label, level) => el('li', {}, el('span', { className: `heat-swatch heat-${level}`, ariaHidden: 'true' }), label)),
  );
};

const render = (latest) => {
  if (!latest) return;
  profile = latest;
  const now = Date.now();
  $('player-missing').hidden = true;
  $('player-body').hidden = false;
  renderHead(now);
  renderStats(now);
  renderSeeding();
  renderActivity(now);
  renderMatches();
};

for (const button of document.querySelectorAll('.period button')) {
  button.addEventListener('click', () => {
    period = Number(button.dataset.days);
    if (profile) renderStats(Date.now());
  });
}

$('more-matches').addEventListener('click', () => {
  shown += MATCHES_SHOWN;
  renderMatches();
});

renderLegend();

if (/^[0-9a-f]{12}$/.test(id)) {
  startLive(render, {
    url: apiUrl(`player?id=${id}`),
    sample: (now) => demoProfile(id, now),
    missing: () => showMissing('No player found', 'The link may be old: players are listed for 90 days after they last played on our server.'),
  });
} else {
  showMissing('Pick a player', 'This page shows one player’s stats. Find a player in the list of everyone who has played on our server.');
}
