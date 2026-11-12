import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoMotd, demoMotdChange } from '../public/js/demo.js';
import {
  canApply,
  countText,
  linesOf,
  MAX_CHARS,
  MAX_LINES,
  outcomeText,
  previewStyle,
  readLine,
  RULES_TEMPLATE,
  sameMessage,
  textOf,
  validate,
} from '../public/js/motdmodel.js';

const problems = (line) => readLine(line).problems;

describe('the website rules template', () => {
  it('is the approved message and breaks no rule', () => {
    assert.equal(RULES_TEMPLATE.length, 19);
    assert.equal(RULES_TEMPLATE[0], '<Header>Welcome to gaminginit</>');
    assert.equal(RULES_TEMPLATE.at(-1), '<Italic>Have fun &amp; good hunting!</>');
    assert.deepEqual(validate(RULES_TEMPLATE), []);
  });
});

describe('a line the game accepts', () => {
  for (const line of [
    '',
    'plain text',
    '<Header>Welcome to gaminginit</>',
    '<Bold>1. No cheats</> - no aimbots',
    '<Italic>Have fun &amp; good hunting!</>',
    '<text color="#E8A33D" size="16" fontface="Bold">Play hard, play fair.</>',
    '<text>no attributes</>',
    '<text size="8">small</> and <text size="24">big</>',
    'Ask in our Discord: <text color="#7FD6FF">discord.gg/qsJFYGhSJ4</>',
    '&lt;3 &quot;quoted&quot;',
  ]) {
    it(`accepts ${JSON.stringify(line)}`, () => assert.deepEqual(problems(line), []));
  }
});

describe('a line the game refuses', () => {
  const cases = [
    ['<Bold>never closed', /never closed/],
    ['closed</>', /no tag to close/],
    ['<Bold><Italic>x</></>', /inside each other/],
    ['<Header color="#FFFFFF">x</>', /Header> takes no attributes/],
    ['<Bold size="9">x</>', /takes no attributes/],
    ['<a href="x">link</>', /isn't a tag/],
    ['<bold>x</>', /case sensitive/],
    ['<text size="7">x</>', /from 8 to 24/],
    ['<text size="25">x</>', /from 8 to 24/],
    ['<text size="1.5">x</>', /whole number/],
    ['<text color="red">x</>', /#E8A33D/],
    ['<text color="#FFF">x</>', /six hex/],
    ['<text fontface="Comic">x</>', /Bold" or "Italic/],
    ['<text colour="#FFFFFF">x</>', /no colour attribute/],
    ['<text size="9" size="10">x</>', /twice/],
    ['<text size=16>x</>', /straight double quotes/],
    ['<text size=“16”>x</>', /straight quotes/],
    ['<text size="16”>x</>', /straight quotes/],
    ['a > b', /">" on its own/],
    ['a < b', /"<"/],
    ['fish & chips', /"&" on its own/],
    ['say "hi"', /&quot;/],
    ['bad &nbsp; entity', /"&" on its own/],
  ];
  for (const [line, message] of cases) {
    it(`refuses ${JSON.stringify(line)}`, () => assert.match(problems(line).join('\n'), message));
  }

  it('reports a bad tag once, not again for its close', () => {
    assert.equal(problems('<a>x</>').length, 1);
  });
});

describe('counting what shows', () => {
  it('leaves tags out and counts each entity as one', () => {
    assert.equal(readLine('<Bold>abc</>').visible, 3);
    assert.equal(readLine('&amp;&lt;&gt;&quot;').visible, 4);
    assert.equal(readLine('<text color="#FFFFFF" size="9">hi</> there').visible, 8);
    assert.equal(readLine('\u{1F600}x').visible, 2);
  });

  it('allows 128 characters in a line and refuses 129', () => {
    assert.deepEqual(problems('a'.repeat(MAX_CHARS)), []);
    assert.deepEqual(problems(`<Bold>${'a'.repeat(MAX_CHARS)}</>`), []);
    assert.deepEqual(problems('&amp;'.repeat(MAX_CHARS)), []);
    assert.match(problems('a'.repeat(MAX_CHARS + 1)).join(), /129 characters/);
    assert.match(problems('&amp;'.repeat(MAX_CHARS + 1)).join(), /129 characters/);
  });

  it('allows 128 lines and refuses 129, numbering lines from 1', () => {
    assert.deepEqual(validate(Array.from({ length: MAX_LINES }, () => 'x')), []);
    assert.deepEqual(validate(Array.from({ length: MAX_LINES + 1 }, () => 'x')), [{ line: null, problem: '129 lines, but a message can have at most 128.' }]);
    assert.deepEqual(validate(['ok', '<Bold>x', 'fine']), [{ line: 2, problem: '<Bold> is never closed. End it with </>.' }]);
  });

  it('writes a count as the page shows it', () => assert.equal(countText(12), '12 / 128'));
});

describe('the preview', () => {
  it('splits a line into its styled pieces, with entities as the characters they stand for', () => {
    assert.deepEqual(readLine('<Bold>1. No cheats</> - no hacks').segments, [
      { text: '1. No cheats', style: { tag: 'Bold' } },
      { text: ' - no hacks', style: null },
    ]);
    assert.deepEqual(readLine('<Italic>Have fun &amp; good hunting!</>').segments, [{ text: 'Have fun & good hunting!', style: { tag: 'Italic' } }]);
    assert.deepEqual(readLine('<text size="20" fontface="Bold" color="#FF4D4D">RULES</>').segments, [
      { text: 'RULES', style: { tag: 'text', size: 20, fontface: 'Bold', color: '#FF4D4D' } },
    ]);
  });

  it('has nothing for a blank line, and shows a bad tag as written', () => {
    assert.deepEqual(readLine('').segments, []);
    assert.deepEqual(readLine('a <a>b</> c').segments.map((s) => s.text).join(''), 'a b c');
    assert.equal(readLine('x < y').segments.map((s) => s.text).join(''), 'x < y');
  });

  it('draws each style: header big, bold, italic, and a text tag by its colour, size and face', () => {
    assert.equal(previewStyle(null), null);
    assert.deepEqual(previewStyle({ tag: 'Header' }), { fontSize: 24, bold: true, italic: false, color: null });
    assert.deepEqual(previewStyle({ tag: 'Bold' }), { fontSize: null, bold: true, italic: false, color: null });
    assert.deepEqual(previewStyle({ tag: 'Italic' }), { fontSize: null, bold: false, italic: true, color: null });
    assert.deepEqual(previewStyle({ tag: 'text', size: 16, fontface: 'Italic', color: '#7FD6FF' }), { fontSize: 16, bold: false, italic: true, color: '#7FD6FF' });
    assert.deepEqual(previewStyle({ tag: 'text' }), { fontSize: null, bold: false, italic: false, color: null });
  });
});

describe('the editor text', () => {
  it('is one line each, with blank lines at the end dropped', () => {
    assert.deepEqual(linesOf('a\n\nb\r\nc\n\n'), ['a', '', 'b', 'c']);
    assert.deepEqual(linesOf(''), []);
    assert.deepEqual(linesOf('\n\n'), []);
    assert.equal(textOf(['a', '', 'b']), 'a\n\nb');
  });

  it('compares messages by whether they are on and what they say', () => {
    assert.equal(sameMessage({ enabled: true, lines: ['a', ''] }, { enabled: true, lines: ['a'] }), true);
    assert.equal(sameMessage({ enabled: true, lines: ['a'] }, { enabled: false, lines: ['a'] }), false);
    assert.equal(sameMessage({ enabled: true, lines: ['a'] }, { enabled: true, lines: ['b'] }), false);
  });

  it('can be applied only when it changed, breaks no rule and nothing is on its way', () => {
    const server = { enabled: true, lines: ['a'] };
    assert.equal(canApply({ enabled: true, lines: ['a'] }, server), false);
    assert.equal(canApply({ enabled: false, lines: ['a'] }, server), true);
    assert.equal(canApply({ enabled: true, lines: ['<Bold>b'] }, server), false);
    assert.equal(canApply({ enabled: true, lines: ['b'] }, server, true), false);
  });

  it('says what the server did', () => {
    assert.equal(outcomeText('next-match'), 'Saved — shows from the next match.');
    assert.match(outcomeText('unchanged'), /already has/);
  });
});

describe('the sample server', () => {
  it('starts with the website rules, and takes a change as the bot does', async () => {
    const first = (await demoMotd()).json;
    assert.deepEqual(first.lines, RULES_TEMPLATE);
    assert.equal(first.enabled, true);
    assert.deepEqual(first.problems, []);

    const bad = await demoMotdChange({ enabled: true, lines: ['<a>x</>'], revision: first.revision });
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 400);
    assert.equal(bad.json.problems[0].line, 1);

    const saved = await demoMotdChange({ enabled: false, lines: ['<Bold>Hi</>', ''], revision: first.revision });
    assert.equal(saved.ok, true);
    assert.equal(saved.json.outcome, 'next-match');
    assert.deepEqual(saved.json.lines, ['<Bold>Hi</>']);
    assert.equal(saved.json.enabled, false);

    const stale = await demoMotdChange({ enabled: true, lines: ['x'], revision: first.revision });
    assert.equal(stale.status, 409);

    const same = await demoMotdChange({ enabled: false, lines: ['<Bold>Hi</>'], revision: saved.json.revision });
    assert.equal(same.json.outcome, 'unchanged');
  });
});
