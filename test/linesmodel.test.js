import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fillLine, groupLists, lineProblem, linesToSave, listLabel, messageLength, messageParts, problemCount, sameLines, tidyLine } from '../public/js/linesmodel.js';

const after = ' Seed on 3 days in a week and get a reserved slot. How at gaminginit.com';
const halfway = {
  id: 'halfway.valkyra',
  group: 'Halfway',
  name: 'Valkyra',
  values: { team: 'Valkyra', score: '50' },
  longest: { team: 'x'.repeat(16), score: '100' },
  before: 'Halfway there! ',
  after,
  lines: ['Valkyra leads on {score}. Not my points, OUR points, comrade.'],
};
const level = { id: 'halfwayLevel', group: 'Halfway', name: 'Level scores', values: {}, longest: {}, before: '', after, lines: ['Level!'] };
const needed = { needed: '19 more players' };
const seeding = { id: 'seeding', group: 'Seeding', name: 'Seeding', values: needed, longest: needed, before: '', after: '', lines: [] };

describe('tidyLine', () => {
  it('puts a line on one line, without spare spaces', () => {
    assert.equal(tidyLine('  Red  leads\n on {score}. '), 'Red leads on {score}.');
    assert.equal(tidyLine(undefined), '');
  });
});

describe('the message in game', () => {
  it('fills in the placeholders the list has, and leaves others as they are', () => {
    assert.equal(fillLine('{team} on {score} at {site}', halfway.values), 'Valkyra on 50 at {site}');
  });

  it('puts what the bot adds around the line', () => {
    assert.deepEqual(messageParts(halfway, ' {team} on {score}. '), { before: 'Halfway there! ', line: 'Valkyra on 50.', after });
  });

  it('counts the message at its longest: each placeholder as long as it can be when it goes out', () => {
    assert.equal(messageLength(halfway, '{team} on {score}.'), `Halfway there! ${'x'.repeat(16)} on 100.`.length + after.length);
  });
});

describe('lineProblem', () => {
  const room = 200 - 'Halfway there! '.length - after.length;

  it('passes a line that fits, and a blank one (blank lines are dropped)', () => {
    assert.equal(lineProblem(halfway, halfway.lines[0], 200), null);
    assert.equal(lineProblem(halfway, 'x'.repeat(room), 200), null);
    assert.equal(lineProblem(halfway, '   ', 200), null);
  });

  it('says how much too long a line is, with what the bot adds', () => {
    assert.equal(lineProblem(halfway, 'x'.repeat(room + 3), 200), '3 characters too long for the game.');
    // The preview shows 50, but the leader can be on 100 when it goes out.
    assert.equal(lineProblem(halfway, `${'x'.repeat(room - 3)}{score}`, 200), null);
    assert.equal(lineProblem(halfway, `${'x'.repeat(room - 2)}{score}`, 200), '1 character too long for the game.');
    assert.equal(lineProblem(halfway, 'x'.repeat(room + 1), 200), '1 character too long for the game.');
    // {needed} counts as "19 more players".
    assert.equal(lineProblem(seeding, `${'x'.repeat(185)}{needed}`, 200), null);
    assert.equal(lineProblem(seeding, `${'x'.repeat(186)}{needed}`, 200), '1 character too long for the game.');
  });

  it('names placeholders the bot cannot fill in for the list', () => {
    assert.equal(lineProblem(halfway, '{team} at {site} and {sitee}', 200), "The bot can't fill in {site} and {sitee} here. It can fill in {team} and {score}.");
    assert.equal(lineProblem(level, 'Level on {score}', 200), "The bot can't fill in {score} here. These lines have nothing to fill in.");
    assert.equal(lineProblem(seeding, 'Score {score}', 200), "The bot can't fill in {score} here. It can fill in {needed}.");
  });

  it('counts the saved lines with something wrong', () => {
    assert.equal(problemCount({ ...halfway, lines: [...halfway.lines, 'x'.repeat(room + 1), '{site}'] }, 200), 2);
  });
});

describe('lists', () => {
  it('saves lines tidied, without blank ones, and knows when nothing changed', () => {
    assert.deepEqual(linesToSave([' A  line ', '', '  ', 'B']), ['A line', 'B']);
    assert.equal(sameLines(['A', 'B'], ['A', 'B']), true);
    assert.equal(sameLines(['A', 'B'], ['B', 'A']), false);
    assert.equal(sameLines(['A'], ['A', 'B']), false);
  });

  it('groups lists in order, and names a list alone in its group by the group', () => {
    const groups = groupLists([seeding, halfway, level]);
    assert.deepEqual(
      groups.map((g) => [g.name, g.lists.map((l) => l.id)]),
      [
        ['Seeding', ['seeding']],
        ['Halfway', ['halfway.valkyra', 'halfwayLevel']],
      ],
    );
    assert.equal(listLabel(seeding), 'Seeding');
    assert.equal(listLabel(halfway), 'Halfway: Valkyra');
  });
});
