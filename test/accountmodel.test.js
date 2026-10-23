import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canVote,
  choiceIn,
  errorText,
  hasResult,
  joinText,
  perkLines,
  placeOf,
  readHash,
  sessionName,
  shortName,
  signinBound,
  steamText,
  vipText,
  voteOffer,
} from '../public/js/accountmodel.js';

const token = (payload) => `${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.signature`;

describe('readHash', () => {
  it('reads what the bot put after the #', () => {
    assert.deepEqual(readHash('#session=abc.def&member=1&join=added&steam=linked'), { session: 'abc.def', member: '1', join: 'added', steam: 'linked' });
    assert.deepEqual(readHash('#steamproof=xyz'), { steamproof: 'xyz' });
    assert.deepEqual(readHash('#error=expired'), { error: 'expired' });
  });

  it('ignores anything else, and empty values', () => {
    assert.deepEqual(readHash(''), {});
    assert.deepEqual(readHash('#players/12345'), {});
    assert.deepEqual(readHash('#session=&other=1'), {});
  });
});

describe('hasResult', () => {
  it('is true for a session, a Steam proof or an error, and not for a page anchor', () => {
    assert.equal(hasResult('#session=x'), true);
    assert.equal(hasResult('#steamproof=x'), true);
    assert.equal(hasResult('#error=failed'), true);
    assert.equal(hasResult('#member=1'), false);
    assert.equal(hasResult('#weapons'), false);
  });
});

describe('sessionName', () => {
  it('reads the name in a session token, including names that are not plain ASCII', () => {
    assert.equal(sessionName(token({ userId: '1', name: 'Sarge', expiresAt: 1 })), 'Sarge');
    assert.equal(sessionName(token({ userId: '1', name: 'Zoë 🎖️', expiresAt: 1 })), 'Zoë 🎖️');
  });

  it('gives null for anything that is not a token', () => {
    assert.equal(sessionName('nonsense'), null);
    assert.equal(sessionName(token({ name: '' })), null);
    assert.equal(sessionName(token({ name: 5 })), null);
    assert.equal(sessionName(''), null);
  });
});

describe('shortName', () => {
  it('keeps short names and cuts long ones', () => {
    assert.equal(shortName('Sarge'), 'Sarge');
    assert.equal(shortName('A very long Discord name'), 'A very long D…');
    assert.equal(shortName('x'.repeat(14)), 'x'.repeat(14));
  });
});

describe('what the page says', () => {
  it('words each way a sign-in can fail, and has a line for ones it does not know', () => {
    assert.match(errorText('cancelled'), /cancelled/);
    assert.match(errorText('expired'), /another browser/);
    assert.match(errorText('steam'), /Steam did not confirm/);
    assert.match(errorText('unbound'), /did not start in this browser/);
    assert.match(errorText('weird'), /Something went wrong/);
  });

  it('says what the join button did, and nothing when it was not pressed', () => {
    assert.equal(joinText('added').kind, 'good');
    assert.equal(joinText('already').kind, 'good');
    assert.equal(joinText('banned').kind, 'bad');
    assert.equal(joinText('unavailable').kind, 'bad');
    assert.equal(joinText('no'), null);
    assert.equal(joinText(undefined), null);
  });

  it('says what was found of the Steam account', () => {
    assert.equal(steamText('linked').kind, 'good');
    assert.equal(steamText('taken').kind, 'bad');
    assert.equal(steamText('none'), null);
  });

  it('says how long VIP lasts and where it came from', () => {
    const now = Date.UTC(2026, 9, 17, 12);
    assert.equal(vipText(null, now, 'en-GB'), 'You have no VIP right now. Seed to earn it.');
    assert.match(vipText({ until: now + 4 * 86_400_000, source: 'seeding' }, now, 'en-GB'), /4 days left\), earned by seeding\.$/);
    assert.match(vipText({ until: now + 3_600_000, source: 'bounty' }, now, 'en-GB'), /less than a day left\), earned by ending a kill streak\.$/);
    assert.match(vipText({ until: now + 3_600_000, source: 'staff' }, now, 'en-GB'), /less than a day left\), given by staff\.$/);
  });

  it('lists only the perks the bot can give', () => {
    assert.deepEqual(perkLines({ role: false, vipRole: false, messages: false, join: false }), [
      'Your player page and your season, one tap away.',
      'Vote for the next map right here on the website.',
    ]);
    const all = perkLines({ role: true, vipRole: true, messages: true, join: true });
    assert.equal(all.length, 5);
    assert.match(all[0], /role in the Discord/);
    assert.match(all[2], /message/);
  });
});

describe('voting here', () => {
  const vote = { id: '1759300000000', open: true, closesAt: 100_000 };
  const member = { member: true };

  it('is for a signed-in member while the vote is open', () => {
    assert.equal(canVote(member, vote, 50_000), true);
    assert.equal(canVote(member, vote, 100_000), false);
    assert.equal(canVote(member, { ...vote, open: false }, 50_000), false);
    assert.equal(canVote(member, null, 50_000), false);
    assert.equal(canVote({ member: false }, vote, 50_000), false);
    assert.equal(canVote({ member: null }, vote, 50_000), false);
    assert.equal(canVote(null, vote, 50_000), false);
  });

  it('offers a sign-in to someone signed out and the join to someone who is not a member', () => {
    assert.equal(voteOffer(null), 'sign-in');
    assert.equal(voteOffer({ member: false }), 'join');
    assert.equal(voteOffer({ member: null }), 'join');
    assert.equal(voteOffer(member), null);
  });

  it('knows the choice they made in this vote, and not one from an earlier vote', () => {
    const ballot = { poll: '1759300000000', map: 'Foy', light: 'night', weather: 'rain' };
    assert.equal(choiceIn(ballot, vote, 'map'), 'Foy');
    assert.equal(choiceIn(ballot, vote, 'light'), 'night');
    assert.equal(choiceIn(ballot, vote, 'weather'), 'rain');
    assert.equal(choiceIn({ ...ballot, poll: 'old' }, vote, 'map'), null);
    assert.equal(choiceIn({ poll: '1759300000000', map: null, light: null }, vote, 'map'), null);
    assert.equal(choiceIn(null, vote, 'map'), null);
    assert.equal(choiceIn(ballot, null, 'map'), null);
  });
});

describe('placeOf', () => {
  it('names where a click was, in what the bot counts', () => {
    assert.equal(placeOf('home', 'hero'), 'home-hero');
    assert.equal(placeOf('leaderboard', undefined), 'leaderboard-link');
    assert.equal(placeOf('Season', 'End Card!'), 'season-end-card');
  });

  it('keeps it to 24 characters with no dash left hanging', () => {
    assert.equal(placeOf('leaderboard', 'nav'), 'leaderboard-nav');
    assert.equal(placeOf('some-long-page-name', 'an-even-longer-part').length <= 24, true);
    assert.doesNotMatch(placeOf('abcdefghijklmnopqrstuv', 'x'), /-$/);
  });
});

describe('signinBound', () => {
  it('is only for a sign-in whose value this browser kept', () => {
    assert.equal(signinBound('abc123', '?signin=abc123'), true);
    assert.equal(signinBound('abc123', '?x=1&signin=abc123'), true);
    assert.equal(signinBound('abc123', '?signin=other'), false);
    assert.equal(signinBound('abc123', ''), false);
    assert.equal(signinBound(null, '?signin=abc123'), false);
    assert.equal(signinBound('', '?signin='), false);
    assert.equal(signinBound(undefined, '?signin=undefined'), false);
  });
});
