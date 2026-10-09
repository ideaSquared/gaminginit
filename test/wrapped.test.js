import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hallOfFame, pick, playerSeason, playerStory, seasonStory, THEMES } from '../public/js/wrapped.js';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const START = Date.UTC(2026, 8, 30);
const END = Date.UTC(2026, 9, 15);

const ash = { name: 'Ash', id: 'aaaaaaaaaaaa' };
const bo = { name: 'Bo', id: 'bbbbbbbbbbbb' };

const roundup = (values = {}) => ({
  kind: 'season',
  start: START,
  end: END,
  partial: false,
  matches: 40,
  playedMs: 30 * HOUR,
  players: 500,
  peakPlayers: 100,
  busiestDay: { day: '2026-10-11', players: 300 },
  teams: [
    { name: 'Valkyra', colorHex: '#FA503E', matches: 40, wins: 25, losses: 15 },
    { name: 'Lonestar', colorHex: '#4CB1EF', matches: 40, wins: 10, losses: 30 },
    { name: 'Manticore', colorHex: '#1DD65C', matches: 40, wins: 5, losses: 35 },
  ],
  bestTeam: { name: 'Valkyra', colorHex: '#FA503E', matches: 40, wins: 25, losses: 15 },
  teamMinMatches: 3,
  kdMinMatches: 5,
  kills: [{ ...ash, kills: 900 }, { ...bo, kills: 400 }],
  kd: [{ ...ash, kd: 2.5 }],
  bestMatch: [{ ...ash, kills: 40, deaths: 3, map: 'Ozeti' }],
  wins: [{ ...bo, wins: 20, played: 30 }],
  mvps: [{ ...ash, mvps: 9 }],
  playtime: [{ ...bo, minutes: 6000 }],
  seeding: [{ ...bo, seedDays: 6, minutes: 300 }],
  deaths: [{ ...bo, deaths: 700, kills: 400 }],
  teamKills: [{ ...bo, teamKills: 12 }],
  biggestWin: { map: 'Bakurani', endedAt: START + DAY, factionScores: [{ name: 'Valkyra', score: 100 }, { name: 'Lonestar', score: 10 }] },
  closestMatch: { map: 'Ozeti', endedAt: START + 2 * DAY, factionScores: [{ name: 'Lonestar', score: 99 }, { name: 'Valkyra', score: 100 }] },
  topMap: { map: 'Ozeti', matches: 20 },
  regular: { ...ash, days: 15, of: 15 },
  rookie: null,
  awards: {
    from: '2026-10-04',
    roles: [
      { role: 'assault', top: [{ ...ash, kills: 300 }] },
      { role: 'support', top: [] },
    ],
    headshots: { ...ash, headshots: 80 },
    longest: { ...bo, distance: 642.4, weapon: 'SV98' },
    variety: null,
    roadKills: { ...bo, kills: 7 },
    melee: null,
    sidearm: null,
  },
  days: Array.from({ length: 15 }, (_, i) => ({ day: new Date(START + i * DAY).toISOString().slice(0, 10), players: 100, minutes: 1000, matches: 3, peak: 90 })),
  totals: { kills: 9000, deaths: 9500, minutes: 60_000, seedingMinutes: 900, seedDays: 40 },
  averageMs: 45 * 60_000,
  maps: [],
  streak: { name: 'Valkyra', colorHex: '#FA503E', wins: 6, from: START, to: START + DAY },
  longestMatch: null,
  quickestWin: null,
  weapons: { days: 15, since: '2026-10-04', kills: 5000, headshots: 1000, top: [{ name: 'AK74', kind: 'weapon', kills: 2000, headshots: 400 }], longest: null },
  ...values,
});

const page = (values) => ({ number: 1, name: 'Season 1', endsAt: END, open: true, roundup: roundup(values) });

describe('pick', () => {
  it('picks the same line for the same seed, and spreads seeds over the lines', () => {
    const lines = ['a', 'b', 'c'];
    assert.equal(pick('Ash', lines), pick('Ash', lines));
    const picked = new Set(['Ash', 'Bo', 'Cy', 'Di', 'Eve', 'Fox', 'Gus', 'Hal'].map((name) => pick(name, lines)));
    assert.ok(picked.size > 1);
  });
});

describe('seasonStory', () => {
  const slides = seasonStory(page());
  const keys = slides.map((s) => s.key);

  it('starts with the intro, ends with the buttons, and every slide has its colours', () => {
    assert.equal(keys[0], 'intro');
    assert.equal(keys.at(-1), 'outro');
    assert.equal(slides.at(-1).end, true);
    assert.equal(slides.filter((s) => s.end).length, 1);
    for (const s of slides) assert.ok(s.theme === 'team' || THEMES.includes(s.theme), s.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('roasts the boards the bot sends: the most deaths, friendly fire, the wooden spoon', () => {
    for (const key of ['most-kills', 'most-deaths', 'friendly-fire', 'wooden-spoon', 'team', 'streak', 'longest-shot', 'road-rage', 'weapon']) {
      assert.ok(keys.includes(key), key);
    }
    const spoon = slides.find((s) => s.key === 'wooden-spoon');
    assert.equal(spoon.team.name, 'Manticore');
    const deaths = slides.find((s) => s.key === 'most-deaths');
    assert.deepEqual([deaths.who.name, deaths.big], ['Bo', '700']);
    assert.match(slides.find((s) => s.key === 'kills-total').line, /More deaths than kills/);
    assert.equal(slides.find((s) => s.key === 'best-kd').small, 'From 5 matches.');
  });

  it('leaves out what the roundup does not have', () => {
    const bare = seasonStory(
      page({ awards: null, weapons: null, deaths: [], teamKills: null, streak: null, bestTeam: null, teams: [], topMap: null, mvps: [], closestMatch: null, biggestWin: null, regular: null }),
    );
    const left = bare.map((s) => s.key);
    for (const key of ['roles', 'longest-shot', 'mentions', 'weapon', 'most-deaths', 'friendly-fire', 'streak', 'team', 'wooden-spoon', 'map', 'closest', 'biggest']) {
      assert.ok(!left.includes(key), key);
    }
    assert.ok(left.includes('most-kills'));
  });

  it('lists only the roles somebody won, and a short streak is no slide', () => {
    assert.deepEqual(slides.find((s) => s.key === 'roles').list.map((row) => row.label), ['Assault']);
    assert.ok(!seasonStory(page({ streak: { name: 'Valkyra', wins: 2, from: START, to: START } })).some((s) => s.key === 'streak'));
  });

  it('says a staff preview is the season so far', () => {
    const early = seasonStory({ ...page(), open: false, roundup: roundup({ partial: true }) });
    assert.equal(early[0].unit, 'so far');
    assert.equal(early.at(-1).big, 'To be continued');
  });
});

describe('playerSeason', () => {
  const generatedAt = Date.UTC(2026, 9, 20, 12);
  const profile = {
    id: ash.id,
    name: 'Ash',
    generatedAt,
    days: 90,
    activity: [
      { day: '2026-09-29', seedingMinutes: 0, liveMinutes: 999, seedDays: 0, matches: 9, kills: 99, deaths: 9 },
      { day: '2026-10-01', seedingMinutes: 30, liveMinutes: 90, seedDays: 1, matches: 2, kills: 30, deaths: 10 },
      { day: '2026-10-14', seedingMinutes: 0, liveMinutes: 60, seedDays: 0, matches: 1, kills: 12, deaths: 20 },
      // After the wipe: Season 2.
      { day: '2026-10-15', seedingMinutes: 0, liveMinutes: 500, seedDays: 0, matches: 5, kills: 400, deaths: 1 },
    ],
    matches: [
      { map: 'Ozeti', endedAt: Date.UTC(2026, 9, 1, 20), kills: 18, deaths: 4, place: 1, faction: 'Valkyra', result: 'won' },
      { map: 'Ozeti', endedAt: Date.UTC(2026, 9, 1, 21), kills: 12, deaths: 6, place: 9, faction: 'Valkyra', result: 'lost' },
      { map: 'Bakurani', endedAt: Date.UTC(2026, 9, 14, 21), kills: 12, deaths: 20, place: 40, faction: 'Lonestar', result: null },
      { map: 'Zestafona', endedAt: Date.UTC(2026, 9, 15, 1), kills: 90, deaths: 0, place: 1, faction: 'Lonestar', result: 'won' },
    ],
    weapons: {
      since: '2026-10-01',
      used: [
        { day: '2026-10-01', name: 'AK74', kind: 'weapon', lockOn: false, kills: 20, headshots: 5, longest: 210 },
        { day: '2026-10-14', name: 'SV98', kind: 'weapon', lockOn: false, kills: 8, headshots: 6, longest: 640 },
        { day: '2026-10-15', name: 'SV98', kind: 'weapon', lockOn: false, kills: 90, headshots: 90, longest: 999 },
      ],
    },
  };

  it('adds up their days and matches in the season only', () => {
    const stats = playerSeason(profile, START, END);
    assert.deepEqual(
      { minutes: stats.minutes, days: stats.days, seedDays: stats.seedDays, kills: stats.kills, deaths: stats.deaths },
      { minutes: 180, days: 2, seedDays: 1, kills: 42, deaths: 30 },
    );
    assert.deepEqual({ matches: stats.matches, wins: stats.wins, decided: stats.decided, mvps: stats.mvps }, { matches: 3, wins: 1, decided: 2, mvps: 1 });
    assert.deepEqual(stats.best, { kills: 18, deaths: 4, map: 'Ozeti', endedAt: Date.UTC(2026, 9, 1, 20) });
    assert.deepEqual(stats.map, { name: 'Ozeti', matches: 2 });
    assert.deepEqual(stats.side, { name: 'Valkyra', matches: 2 });
    assert.equal(stats.weapon.name, 'AK74');
    assert.deepEqual(stats.longest, { distance: 640, weapon: 'SV98' });
    assert.equal(stats.cutFrom, null);
  });

  it('says when their player page no longer goes back to the start of the season', () => {
    const later = { ...profile, generatedAt: Date.UTC(2027, 0, 10) };
    assert.equal(playerSeason(later, START, END).cutFrom, '2026-10-13');
  });
});

describe('hallOfFame', () => {
  it("finds a player's places on the season's boards, best first", () => {
    assert.deepEqual(hallOfFame(roundup(), bo.id), [
      { key: 'wins', title: 'most wins', place: 1 },
      { key: 'playtime', title: 'most time played', place: 1 },
      { key: 'seeding', title: 'top seeders', place: 1 },
      { key: 'deaths', title: 'most deaths', place: 1 },
      { key: 'teamKills', title: 'most team kills', place: 1 },
      { key: 'kills', title: 'most kills', place: 2 },
    ]);
    assert.deepEqual(hallOfFame(roundup(), 'cccccccccccc'), []);
  });
});

describe('playerStory', () => {
  const stats = {
    name: 'Bo',
    id: bo.id,
    minutes: 40 * 60,
    days: 10,
    seedDays: 0,
    kills: 300,
    deaths: 400,
    matches: 20,
    wins: 5,
    decided: 20,
    mvps: 0,
    best: { kills: 25, deaths: 5, map: 'Ozeti', endedAt: START + DAY },
    map: { name: 'Ozeti', matches: 9 },
    side: null,
    weapon: null,
    longest: null,
    cutFrom: null,
  };

  it('roasts them by their numbers', () => {
    const slides = playerStory(stats, page(), 15);
    const line = (key) => slides.find((s) => s.key === key)?.line ?? '';
    assert.match(line('you-wins'), /^25%\. You’re the reason/);
    assert.match(line('you-kills'), /More deaths than kills/);
    assert.match(line('you-seeding'), /^Zero\./);
    assert.ok(!slides.some((s) => s.key === 'you-weapon'));
    const fame = slides.find((s) => s.key === 'you-fame');
    assert.equal(fame.big, '#1');
    assert.equal(fame.list.length, 3);
    assert.equal(slides.at(-1).end, true);
  });

  it('teases a top 10 nobody wants', () => {
    const r = roundup({ wins: [], playtime: [], seeding: [], kills: [] });
    const fame = playerStory(stats, { ...page(), roundup: r }, 15).find((s) => s.key === 'you-fame');
    assert.equal(fame.unit, 'for most deaths');
    assert.match(fame.line, /not the one you wanted/);
  });

  it('has a short story for someone who never played', () => {
    const slides = playerStory({ ...stats, minutes: 0, days: 0, matches: 0, decided: 0 }, page(), 15);
    assert.deepEqual(
      slides.map((s) => s.key),
      ['you-intro', 'you-absent', 'you-outro'],
    );
  });
});
