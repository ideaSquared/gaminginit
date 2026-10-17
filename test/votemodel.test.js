import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countdown, share, statusText, winnerOf } from '../public/js/votemodel.js';

const open = { id: '1', open: true, fromName: 'Ozeti', closesAt: 100_000, winner: null, note: null, pending: false };

describe('countdown', () => {
  it('shows minutes and seconds left, and never goes below zero', () => {
    assert.equal(countdown(125_000, 0), '2:05');
    assert.equal(countdown(1_001, 0), '0:02');
    assert.equal(countdown(0, 5_000), '0:00');
  });
});

describe('share', () => {
  it('is a whole percent, and 0 with no votes', () => {
    assert.equal(share(1, 3), 33);
    assert.equal(share(0, 0), 0);
  });
});

describe('statusText', () => {
  it('says when there is no vote', () => {
    assert.match(statusText(null, 0), /No vote right now/);
  });

  it('counts down while open', () => {
    assert.equal(statusText(open, 40_000), 'Voting in Discord for the map after Ozeti. Closes in 1:00.');
  });

  it('names the winner, infantry only, once it is on the server', () => {
    const won = { ...open, open: false, winner: { map: 'A', name: 'Alpha' } };
    assert.equal(statusText(won, 200_000), 'Alpha plays next, infantry only.');
    assert.equal(statusText({ ...won, pending: true }, 200_000), 'Alpha won. Putting it on the server…');
    assert.equal(winnerOf(won), 'A');
  });

  it('gives the bot\'s reason when nothing was chosen, and counts while it settles', () => {
    assert.equal(statusText({ ...open, open: false, note: 'Nobody voted, so the rotation carries on.' }, 200_000), 'Nobody voted, so the rotation carries on.');
    assert.equal(statusText(open, 200_000), 'Counting the votes…');
    assert.equal(winnerOf(null), null);
  });
});
