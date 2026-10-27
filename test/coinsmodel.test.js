import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buyLabel,
  canPress,
  coinText,
  earnRows,
  itemName,
  logLine,
  percent,
  shopGroups,
  tierLabel,
  todayText,
  whitelistText,
} from '../public/js/coinsmodel.js';

const rates = { seed: 150, seedMinutes: { per: 2, cap: 30 }, playMinutes: 10, match: 6, win: 6, matchesPaid: 6, activityCap: 100 };

describe('coinText', () => {
  it('says one coin and many, with thousands separated', () => {
    assert.equal(coinText(1), '1 INITcoin');
    assert.equal(coinText(0), '0 INITcoins');
    assert.equal(coinText(12345), '12,345 INITcoins');
  });
});

describe('percent and tiers', () => {
  it('keeps a bar between nothing and full', () => {
    assert.equal(percent(1, 4), 25);
    assert.equal(percent(9, 4), 100);
    assert.equal(percent(-3, 4), 0);
    assert.equal(percent(0, 0), 100);
  });

  it('names the tiers', () => {
    assert.deepEqual([0, 1, 2, 9].map(tierLabel), ['Easy', 'Medium', 'Hard', 'Mission']);
  });
});

describe('logLine', () => {
  it('says what a change was for, with its sign', () => {
    assert.deepEqual(logLine({ at: 0, delta: 150, why: 'seed' }), { what: 'Seeding', delta: '+150', gain: true });
    assert.deepEqual(logLine({ at: 0, delta: -600, why: 'buy', note: 'Whitelist, 7 days' }), { what: 'Shop: Whitelist, 7 days', delta: '−600', gain: false });
    assert.equal(logLine({ at: 0, delta: 10, why: 'mission', note: 'Play 2 matches' }).what, 'Mission: Play 2 matches');
    assert.equal(logLine({ at: 0, delta: 1, why: 'something-new' }).what, 'something-new');
  });
});

describe('earnRows', () => {
  it('lists what pays, from the bot’s own rates', () => {
    const rows = earnRows(rates);
    assert.deepEqual(rows.map((r) => [r.what, r.pays]), [
      ['A successful seed', '150'],
      ['Time spent seeding', '1 per 2 min'],
      ['Playing', '1 per 10 min'],
      ['A match played', '6'],
      ['A match won', '+6'],
      ['Missions', '10 to 80'],
    ]);
    assert.match(rows[3].note, /first 6 matches/);
  });

  it('leaves out what the bot has switched off', () => {
    const rows = earnRows({ ...rates, seedMinutes: { per: 0, cap: 0 }, playMinutes: 0 });
    assert.deepEqual(rows.map((r) => r.what), ['A successful seed', 'A match played', 'A match won', 'Missions']);
  });
});

describe('the shop', () => {
  const shop = [
    { id: 'vip-1', kind: 'vip', name: 'Whitelist, 1 day', price: 100, owned: false, afford: true },
    { id: 'title-grunt', kind: 'title', name: 'Title: Grunt', price: 800, owned: true, afford: false },
    { id: 'title-alpha', kind: 'title', name: 'Title: Alpha', price: 6000, owned: false, afford: false },
    { id: 'role-1', kind: 'role', name: 'Discord role: Night Owl', price: 1500, owned: true, afford: true },
  ];

  it('groups by kind, in order, leaving out kinds with nothing', () => {
    assert.deepEqual(shopGroups(shop).map((g) => [g.kind, g.items.length]), [['vip', 1], ['title', 2], ['role', 1]]);
    assert.deepEqual(shopGroups(shop.filter((i) => i.kind === 'vip')).map((g) => g.kind), ['vip']);
  });

  it('drops the kind from a name', () => {
    assert.equal(itemName(shop[1]), 'Grunt');
    assert.equal(itemName(shop[3]), 'Night Owl');
    assert.equal(itemName(shop[0]), 'Whitelist, 1 day');
  });

  it('labels the buy button, asking twice before paying', () => {
    assert.equal(buyLabel(shop[0], false), 'Buy · 100');
    assert.equal(buyLabel(shop[0], true), 'Press again to pay 100');
    assert.equal(buyLabel(shop[1], false), 'Owned');
    assert.equal(buyLabel(shop[3], false), 'Get the role again');
  });

  it('only lets them press what they can buy, or a role to get it back', () => {
    assert.equal(canPress(shop[0]), true);
    assert.equal(canPress(shop[1]), false);
    assert.equal(canPress(shop[2]), false);
    assert.equal(canPress(shop[3]), true);
  });
});

describe('whitelistText and todayText', () => {
  const now = Date.UTC(2026, 9, 27, 12);

  it('says how long the whitelist has to run', () => {
    assert.match(whitelistText(null, now, 'en-GB'), /no whitelist/);
    assert.match(whitelistText(now - 1, now, 'en-GB'), /no whitelist/);
    assert.match(whitelistText(now + 3 * 86_400_000, now, 'en-GB'), /runs to .*30 Oct.* \(3 days left\)/);
    assert.match(whitelistText(now + 3_600_000, now, 'en-GB'), /less than a day/);
  });

  it('says how much of the daily limit is used', () => {
    assert.match(todayText({ earned: 40, cap: 100 }), /40 of 100/);
    assert.match(todayText({ earned: 100, cap: 100 }), /reached today’s limit/);
  });
});
