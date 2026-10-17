import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countdown, peekState, peekTitle, RESULT_SHOWN_MS, share, statusText, winnerOf } from '../public/js/votemodel.js';

const open = { id: '1', open: true, fromName: 'Ozeti', closesAt: 100_000, closeScore: 0, closedAt: null, winner: null, note: null, pending: false };

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

  it('counts down while open when only time closes it', () => {
    assert.equal(statusText(open, 40_000), 'Voting in Discord for the map after Ozeti. Closes in 1:00.');
  });

  it('names the score that closes it, not the time, when there is one', () => {
    assert.equal(
      statusText({ ...open, closeScore: 95 }, 40_000),
      'Voting in Discord for the map after Ozeti. Closes when a team reaches 95 points.',
    );
  });

  it('names the winner, infantry only, once it is on the server', () => {
    const won = { ...open, open: false, winner: { map: 'A', name: 'Alpha' } };
    assert.equal(statusText(won, 200_000), 'Alpha plays next, infantry only.');
    assert.equal(statusText({ ...won, lightingName: 'Night, storm' }, 200_000), 'Alpha plays next, infantry only, Night, storm.');
    assert.equal(statusText({ ...won, pending: true }, 200_000), 'Alpha won. Putting it on the server…');
    assert.equal(winnerOf(won), 'A');
  });

  it('gives the bot\'s reason when nothing was chosen, and counts while it settles', () => {
    assert.equal(statusText({ ...open, open: false, note: 'Nobody voted, so the rotation carries on.' }, 200_000), 'Nobody voted, so the rotation carries on.');
    assert.equal(statusText(open, 200_000), 'Counting the votes…');
    assert.equal(winnerOf(null), null);
  });
});

describe('peekState and peekTitle', () => {
  const won = { ...open, open: false, closedAt: 1_000_000, winner: { map: 'A', name: 'Alpha' } };

  it('shows an open vote, and a result for a while after it closed', () => {
    assert.equal(peekState(open, 40_000), 'open');
    assert.equal(peekState(won, 1_000_000 + RESULT_SHOWN_MS - 1), 'won');
    assert.equal(peekState(won, 1_000_000 + RESULT_SHOWN_MS), 'none');
  });

  it('shows nothing without a vote, or one that ended with no winner', () => {
    assert.equal(peekState(null, 0), 'none');
    assert.equal(peekState(undefined, 0), 'none');
    assert.equal(peekState({ ...won, winner: null }, 1_000_001), 'none');
    assert.equal(peekState({ ...open, closesAt: 10 }, 40_000), 'none');
  });

  it('titles the card by what it shows', () => {
    assert.equal(peekTitle(open, 'open'), 'Vote for the next map');
    assert.equal(peekTitle(won, 'won'), 'Next map: Alpha');
  });
});
