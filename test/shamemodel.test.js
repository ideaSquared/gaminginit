import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { barWidth, removedGroups, removedNotes, shameTiles, teamKillTitle, whenText } from '../public/js/shamemodel.js';

const NOW = Date.UTC(2026, 9, 25, 12);
const HOUR = 3_600_000;

describe('teamKillTitle', () => {
  it('gives a title from the bot’s minimum of 3 warnings, a sillier one the more they have', () => {
    assert.equal(teamKillTitle(2), '');
    assert.equal(teamKillTitle(3), 'Friendly fire apprentice');
    assert.equal(teamKillTitle(4), 'Friendly fire apprentice');
    assert.equal(teamKillTitle(5), 'Collateral damage enthusiast');
    assert.equal(teamKillTitle(12), 'Walking friendly-fire incident');
    assert.equal(teamKillTitle(50), 'Honorary enemy combatant');
  });
});

describe('removedGroups', () => {
  it('splits the kicked and banned by what came of it, kicked then banned first, keeping each list’s order', () => {
    const removed = [
      { name: 'A', outcome: 'kicked' },
      { name: 'B', outcome: 'banned' },
      { name: 'C', outcome: 'kicked-then-banned' },
      { name: 'D', outcome: 'kicked' },
    ];
    const groups = removedGroups(removed);

    assert.deepEqual(
      groups.map((g) => [g.outcome, g.players.map((p) => p.name)]),
      [
        ['kicked-then-banned', ['C']],
        ['banned', ['B']],
        ['kicked', ['A', 'D']],
      ],
    );
  });

  it('has every group even when nobody is in it', () => {
    assert.equal(removedGroups([]).length, 3);
  });
});

describe('removedNotes', () => {
  it('notes a lifted ban and team kill warnings, and nothing otherwise', () => {
    assert.deepEqual(removedNotes({ unbanned: false, teamKillWarnings: 0 }), []);
    assert.deepEqual(removedNotes({ unbanned: true, teamKillWarnings: 1 }), ['Ban lifted', '1 team kill warning too']);
    assert.deepEqual(removedNotes({ unbanned: false, teamKillWarnings: 6 }), ['6 team kill warnings too']);
  });
});

describe('shameTiles', () => {
  it('shows each total', () => {
    const tiles = shameTiles({ teamKillWarnings: 86, warned: 31, kicked: 14, banned: 9 });
    assert.deepEqual(tiles.map((t) => t.value), ['86', '31', '14', '9']);
  });
});

describe('whenText', () => {
  it('counts UTC days', () => {
    assert.equal(whenText(NOW - HOUR, NOW), 'Today');
    assert.equal(whenText(NOW - 20 * HOUR, NOW), 'Yesterday');
    assert.equal(whenText(NOW - 100 * HOUR, NOW), '4 days ago');
  });
});

describe('barWidth', () => {
  it('is a share of the most warned player’s, never too thin to see', () => {
    assert.equal(barWidth(14, 14), 100);
    assert.equal(barWidth(7, 14), 50);
    assert.equal(barWidth(1, 100), 4);
    assert.equal(barWidth(3, 0), 0);
  });
});
