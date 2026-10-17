import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serverChip, voteOpen } from '../public/js/navmodel.js';

const NOW = 1_800_000_000_000;
const stats = (server) => ({ thresholds: { seeding: 1, live: 20 }, server });
const reading = (phase, players, over = {}) => ({ phase, players, maxPlayers: 100, seenAt: NOW - 30_000, ...over });

describe('serverChip', () => {
  it('shows nothing without a reading', () => {
    assert.equal(serverChip(null, NOW), null);
    assert.equal(serverChip(stats(null), NOW), null);
  });

  it('shows a live server with its players out of the maximum', () => {
    const chip = serverChip(stats(reading('live', 34)), NOW);
    assert.equal(chip.kind, 'live');
    assert.equal(chip.label, 'Live');
    assert.equal(chip.count, '34/100');
  });

  it('shows a seeding server with its players out of the number needed to go live', () => {
    const chip = serverChip(stats(reading('seeding', 12)), NOW);
    assert.equal(chip.kind, 'seeding');
    assert.equal(chip.count, '12/20');
    assert.match(chip.title, /8 more to go live/);
  });

  it('invites the first player in to an empty server', () => {
    const chip = serverChip(stats(reading('empty', 0)), NOW);
    assert.equal(chip.kind, 'empty');
    assert.equal(chip.count, '');
    assert.match(chip.title, /first in/);
  });

  it('says offline when the bot has not heard from the server for a while', () => {
    const chip = serverChip(stats(reading('live', 34, { seenAt: NOW - 60 * 60_000 })), NOW);
    assert.equal(chip.kind, 'offline');
    assert.equal(chip.count, '');
  });
});

describe('voteOpen', () => {
  const vote = (over) => ({ open: true, closesAt: NOW + 60_000, winner: null, closedAt: null, ...over });

  it('is true while a vote is open', () => assert.equal(voteOpen(vote({}), NOW), true));
  it('is false with no vote', () => assert.equal(voteOpen(null, NOW), false));
  it('is false once the time has run out', () => assert.equal(voteOpen(vote({ closesAt: NOW - 1 }), NOW), false));
  it('is false for the winner shown after it closed', () => {
    const closed = vote({ open: false, winner: { map: 'A', name: 'Ozeti' }, closedAt: NOW - 60_000 });
    assert.equal(voteOpen(closed, NOW), false);
  });
});
