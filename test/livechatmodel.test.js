import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actionText,
  replyText,
  feedNote,
  filterLines,
  isFlagged,
  mergeLines,
  nameText,
  nearBottom,
  newestId,
  newText,
  placeText,
  verdictText,
} from '../public/js/livechatmodel.js';
import { demoLiveChat } from '../public/js/demo.js';

const ASH = '76561198000000001';
const BO = '76561198000000002';
const line = (id, text, extra = {}) => ({ id, steamId: ASH, name: 'Ash', text, at: 1000 * id, ...extra });
const exact = { kind: 'exact', list: 'racism', word: 'example', action: 'banned' };
const fuzzy = { kind: 'fuzzy', list: 'toxicity', word: 'kys', action: 'alert' };

describe('merging lines', () => {
  it('keeps one line for each id, oldest first', () => {
    const merged = mergeLines([line(1, 'a'), line(3, 'c')], [line(2, 'b'), line(3, 'c again')]);
    assert.deepEqual(merged.map((l) => [l.id, l.text]), [[1, 'a'], [2, 'b'], [3, 'c again']]);
  });

  it('keeps only the latest lines', () => {
    const many = Array.from({ length: 10 }, (_, i) => line(i + 1, 'x'));
    assert.deepEqual(mergeLines([], many, 4).map((l) => l.id), [7, 8, 9, 10]);
    assert.equal(newestId(many), 10);
    assert.equal(newestId([]), 0);
  });

  it('takes a changed verdict for a line it has', () => {
    const merged = mergeLines([line(1, 'a', { verdict: exact })], [line(1, 'a', { verdict: { ...exact, action: 'failed' } })]);
    assert.equal(actionText(merged[0]), 'The action failed');
  });
});

describe('verdicts and actions', () => {
  it('read a line with no verdict as clean', () => {
    assert.equal(isFlagged(line(1, 'gg')), false);
    assert.deepEqual(verdictText(line(1, 'gg')), { tone: 'clean', badge: '', text: '' });
    assert.equal(actionText(line(1, 'gg')), '');
  });

  it('say exact or resembles, the word and the list, in words', () => {
    assert.deepEqual(verdictText(line(1, 'x', { verdict: exact })), { tone: 'exact', badge: 'Exact', text: 'Exact match, racism list: example' });
    assert.deepEqual(verdictText(line(2, 'x', { verdict: fuzzy })), { tone: 'fuzzy', badge: 'Resembles', text: 'Resembles kys on the toxicity list' });
    assert.equal(isFlagged(line(2, 'x', { verdict: fuzzy })), true);
  });

  it('say what the bot did', () => {
    const did = (action) => actionText(line(1, 'x', { verdict: { ...exact, action } }));
    assert.equal(did('banned'), 'Banned');
    assert.equal(did('warned'), 'Warned in game');
    assert.equal(did('alert'), 'Alert only');
    assert.equal(did('staff'), 'Staff: no action');
    assert.match(did('actions-off'), /automatic actions are off/);
    assert.match(did('no-player'), /No player/);
    assert.match(did('folded'), /another line/);
    assert.match(did('backlog'), /before the bot started/);
    assert.equal(did('failed'), 'The action failed');
    assert.equal(did('unheard-of'), '');
  });
});

describe('names and places', () => {
  it('show the name others saw next to the real one, and where it was said', () => {
    assert.equal(nameText(line(1, 'x', { name: '[LAND] Agent Edward', shownAs: 'Olive' })), '[LAND] Agent Edward (shown as Olive)');
    assert.equal(nameText(line(1, 'x', { name: '' })), 'Unknown');
    assert.equal(placeText(line(1, 'x', { channel: 'Team', faction: 'Lonestar' })), 'Team · Lonestar');
    assert.equal(placeText(line(1, 'x', { channel: 'All' })), 'All');
    assert.equal(placeText(line(1, 'x')), '');
  });
});

describe('the filters', () => {
  const lines = [
    line(1, 'gg'),
    line(2, 'bad', { verdict: exact }),
    line(3, 'k y s', { steamId: BO, name: 'Bo', shownAs: 'Olive', verdict: fuzzy }),
    line(4, 'push', { steamId: BO, name: 'Bo' }),
  ];

  it('keep only the flagged lines', () => {
    assert.deepEqual(filterLines(lines, { flaggedOnly: true }).map((l) => l.id), [2, 3]);
    assert.deepEqual(filterLines(lines).map((l) => l.id), [1, 2, 3, 4]);
  });

  it('keep one player: a Steam ID, or part of a name, real or shown', () => {
    assert.deepEqual(filterLines(lines, { player: BO }).map((l) => l.id), [3, 4]);
    assert.deepEqual(filterLines(lines, { player: ' ASH ' }).map((l) => l.id), [1, 2]);
    assert.deepEqual(filterLines(lines, { player: 'olive' }).map((l) => l.id), [3]);
    assert.deepEqual(filterLines(lines, { player: 'bo', flaggedOnly: true }).map((l) => l.id), [3]);
    assert.deepEqual(filterLines(lines, { player: 'nobody' }), []);
  });
});

describe('following the end', () => {
  it('is at the end when the view is within a few pixels of it', () => {
    assert.equal(nearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 500 }), true);
    assert.equal(nearBottom({ scrollTop: 480, scrollHeight: 1000, clientHeight: 500 }), true);
    assert.equal(nearBottom({ scrollTop: 200, scrollHeight: 1000, clientHeight: 500 }), false);
    assert.equal(nearBottom({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 }), true);
  });

  it('counts new lines on the jump button', () => {
    assert.equal(newText(0), 'Jump to latest');
    assert.equal(newText(1), '1 new line: jump to latest');
    assert.equal(newText(5), '5 new lines: jump to latest');
  });
});

describe('what the bot says about the feed', () => {
  it('has a note when it is not reading or the game has no chat', () => {
    assert.equal(feedNote({ enabled: true, available: true }), null);
    assert.match(feedNote({ enabled: false, available: true }), /CHAT_MOD is off/);
    assert.match(feedNote({ enabled: true, available: false }), /does not serve the chat/);
  });
});

describe('the ?demo live chat', () => {
  it('has a fuzzy line, an exact line and a ping, then one new line each time, after the cursor asked', async () => {
    const first = (await demoLiveChat(0)).json;
    assert.equal(first.enabled, true);
    const kinds = first.lines.map((l) => l.verdict.kind);
    assert.ok(kinds.includes('exact') && kinds.includes('fuzzy') && kinds.includes('clean'));
    const next = (await demoLiveChat(first.cursor)).json;
    assert.deepEqual(next.lines.map((l) => l.id), [first.cursor + 1]);
    assert.equal(next.cursor, first.cursor + 1);
    assert.ok(first.lines.some((l) => l.ping));
    assert.ok(first.lines.some((l) => l.rawText && l.rawText !== l.text));
    assert.ok(first.lines.every((l) => typeof l.steamId === 'string' && l.text));
  });
});

describe('a line the bot answered', () => {
  it('says what the bot told the player, and nothing for a line it did not answer', () => {
    assert.match(replyText({ reply: 'cheat' }), /^Bot replied: report it in our Discord with a clip or screenshot, or from the scoreboard without$/);
    assert.equal(replyText({ reply: 'admin' }), 'Bot replied: raise a ticket in our Discord');
    assert.equal(replyText({}), '');
    assert.equal(replyText({ reply: 'something new' }), '');
    for (const reply of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) assert.equal(replyText({ reply }), '', reply);
  });
});
