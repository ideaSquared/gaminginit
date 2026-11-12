// The Welcome message tab's logic, apart from the page: the game's format for the popup players see when they join, what
// is wrong with a message before it is sent, and how it is drawn in the preview. The bot checks a message by the same
// rules when it is saved (GET and POST /api/admin/motd).
//
// One line of the message is one line of the popup; an empty line is a blank one. A line can use `<Header>…</>`,
// `<Bold>…</>`, `<Italic>…</>` and `<text color="#RRGGBB" size="8 to 24" fontface="Bold or Italic">…</>`. Every tag is
// closed with `</>` and they can't be inside each other. Any other tag is refused, links included. To show `< > & "`
// write `&lt; &gt; &amp; &quot;`; each counts as one character.

export const MAX_LINES = 128;
export const MAX_CHARS = 128;
export const MIN_SIZE = 8;
export const MAX_SIZE = 24;

// The message the owner approved, from the website's rules. "Start from the website rules" fills the editor with it.
export const RULES_TEMPLATE = [
  '<Header>Welcome to gaminginit</>',
  '<text color="#E8A33D" size="16" fontface="Bold">Play hard, play fair.</>',
  '',
  '<text size="20" fontface="Bold" color="#FF4D4D">SERVER RULES</>',
  '<Bold>1. No cheats</> - no aimbots, wallhacks or any other hacks.',
  "<Bold>2. No exploits</> - don't use bugs or glitches to get an edge.",
  "<Bold>3. No team kills</> - don't kill your own team on purpose.",
  '<Bold>4. No dropping crates in HQ</> - keep crates out of the HQ.',
  '<Bold>5. No grenade launchers</> - no GLs, anywhere on the server.',
  "<Bold>6. No griefing</> - no blocking, trolling or wrecking your team's vehicles.",
  '<Bold>7. No racism</> - no racism or hate speech, in chat or in your name.',
  '<Bold>8. No abuse</> - be decent to other players and to admins.',
  '',
  '<text color="#6BE38A" fontface="Bold">Admins have the final say.</> Breaking the rules can get you warned, kicked or banned.',
  'Think a call was wrong? Ask in our Discord: <text color="#7FD6FF">discord.gg/qsJFYGhSJ4</>',
  '',
  'Stats, discord, leaderboards and the full rules: <text color="#7FD6FF">gaminginit.com</>',
  '',
  '<Italic>Have fun &amp; good hunting!</>',
];

const ENTITIES = { lt: '<', gt: '>', quot: '"', amp: '&' };
const FONTFACES = ['Bold', 'Italic'];
const SMART_QUOTES = /[‘’‚‛“”„‟′″]/;
const PLAIN_TAGS = ['Header', 'Bold', 'Italic'];

// What is wrong with the attributes of a `<text …>` tag, written as `rest` (everything after `text`), or null.
const attributeProblem = (rest) => {
  if (SMART_QUOTES.test(rest)) return 'Use straight quotes (") around attribute values, not curly ones.';
  const seen = new Set();
  let left = rest;
  for (;;) {
    const match = /^\s+([A-Za-z]+)="([^"]*)"/.exec(left);
    if (match === null) break;
    const [whole, name, value] = match;
    left = left.slice(whole.length);
    if (seen.has(name)) return `The ${name} attribute is there twice.`;
    seen.add(name);
    if (name === 'color') {
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return `color must be like #E8A33D (a # and six hex digits), not "${value}".`;
    } else if (name === 'size') {
      const size = /^\d+$/.test(value) ? Number(value) : NaN;
      if (!(size >= MIN_SIZE && size <= MAX_SIZE)) return `size must be a whole number from ${MIN_SIZE} to ${MAX_SIZE}, not "${value}".`;
    } else if (name === 'fontface') {
      if (!FONTFACES.includes(value)) return `fontface must be "Bold" or "Italic", not "${value}".`;
    } else {
      return `<text> has no ${name} attribute. It takes color, size and fontface.`;
    }
  }
  return left.trim() === '' ? null : 'Write attributes as name="value", with straight double quotes, such as size="16".';
};

// What is wrong inside one tag, `<inner>`, or null when it is one of the game's.
const tagProblem = (inner) => {
  const name = /^[A-Za-z]*/.exec(inner)[0];
  const rest = inner.slice(name.length);
  if (name === 'text' && (rest === '' || /^\s/.test(rest))) return attributeProblem(rest);
  if (PLAIN_TAGS.includes(name)) {
    if (rest === '') return null;
    return name === 'Header' ? '<Header> takes no attributes.' : `<${name}> takes no attributes. Use <text …> for colour or size.`;
  }
  const known = [...PLAIN_TAGS, 'text'].find((tag) => tag.toLowerCase() === name.toLowerCase());
  if (known !== undefined && rest === '') return `Tags are case sensitive: write <${known}>.`;
  if (name === '') return 'A "<" has to start a tag. To show it, write &lt;.';
  return `<${name}> isn't a tag the game knows (a link is refused too). Use <Header>, <Bold>, <Italic> or <text …>.`;
};

// The style a tag gives its text: null for none.
const styleOf = (inner) => {
  const name = /^[A-Za-z]*/.exec(inner)[0];
  if (name !== 'text') return { tag: name };
  const style = { tag: 'text' };
  for (const [, key, value] of inner.matchAll(/\s([A-Za-z]+)="([^"]*)"/g)) {
    if (key === 'color') style.color = value;
    if (key === 'size') style.size = Number(value);
    if (key === 'fontface') style.fontface = value;
  }
  return style;
};

// Reads a line the way the game does. `visible` is how many characters it shows (tags are not counted, and each of &lt;
// &gt; &amp; &quot; is one), `problems` what is wrong with it, and `segments` its text in pieces with the style of each:
// `{ text, style }`, `style` null for plain text. Pieces with a problem are shown as written.
export const readLine = (line) => {
  const problems = [];
  const add = (problem) => {
    if (!problems.includes(problem)) problems.push(problem);
  };
  const segments = [];
  const put = (text, style) => {
    const last = segments.at(-1);
    if (last && last.style === style) last.text += text;
    else segments.push({ text, style });
  };
  let visible = 0;
  // The tag being written, and whether it was a bad one (already reported, so its </> and its end are not).
  let open = null;
  let i = 0;
  while (i < line.length) {
    const c = line.charAt(i);
    if (c === '<') {
      if (line.startsWith('</>', i)) {
        if (open === null) add('There is a </> with no tag to close.');
        open = null;
        i += 3;
        continue;
      }
      const end = line.indexOf('>', i);
      if (end === -1) {
        add('A "<" with no ">" after it. To show it, write &lt;.');
        put(c, open?.style ?? null);
        visible += 1;
        i += 1;
        continue;
      }
      const inner = line.slice(i + 1, end);
      const problem = tagProblem(inner);
      if (problem !== null) add(problem);
      else if (open !== null) add(`Tags can't be inside each other: close <${open.name}> with </> first.`);
      if (open === null) {
        open = { name: /^[A-Za-z]*/.exec(inner)[0], bad: problem !== null, style: problem === null ? styleOf(inner) : null };
      } else if (problem !== null) {
        put(line.slice(i, end + 1), open.style);
      }
      i = end + 1;
      continue;
    }
    if (c === '>') add('A ">" on its own. To show it, write &gt;.');
    if (c === '"') add('A " in the text. To show it, write &quot;.');
    if (c === '\r' || c === '\n') add("A line can't have a line break in it.");
    if (c === '&') {
      const entity = /^&(lt|gt|quot|amp);/.exec(line.slice(i, i + 6));
      if (entity === null) {
        add('A "&" on its own. To show it, write &amp;.');
      } else {
        put(ENTITIES[entity[1]], open?.style ?? null);
        visible += 1;
        i += entity[0].length;
        continue;
      }
    }
    // Counted by character, not by UTF-16 unit.
    const code = line.codePointAt(i);
    const size = code > 0xffff ? 2 : 1;
    put(line.slice(i, i + size), open?.style ?? null);
    visible += 1;
    i += size;
  }
  if (open !== null && !open.bad) add(`<${open.name}> is never closed. End it with </>.`);
  if (visible > MAX_CHARS) add(`${visible} characters shown, but a line can have at most ${MAX_CHARS}.`);
  return { visible, problems, segments };
};

// What is wrong with a message, by line from 1. A problem with the message as a whole has no line (null).
export const validate = (lines) => [
  ...(lines.length > MAX_LINES ? [{ line: null, problem: `${lines.length} lines, but a message can have at most ${MAX_LINES}.` }] : []),
  ...lines.flatMap((line, i) => readLine(line).problems.map((problem) => ({ line: i + 1, problem }))),
];

// The editor's text as the message's lines. Blank lines at the end are dropped: they would only be empty space in the popup.
export const linesOf = (text) => {
  const lines = String(text ?? '').split(/\r?\n/);
  while (lines.length > 0 && lines.at(-1).trim() === '') lines.pop();
  return lines;
};

export const textOf = (lines) => lines.join('\n');

// Two messages, each `{ enabled, lines }`, are the same when both are on or off and say the same.
export const sameMessage = (a, b) => a.enabled === b.enabled && textOf(linesOf(textOf(a.lines))) === textOf(linesOf(textOf(b.lines)));

// "12 / 128", for a line's count.
export const countText = (visible) => `${visible} / ${MAX_CHARS}`;

// How the preview draws a piece of text: a style for it, or nothing for plain text. Header is the big title, and a <text>
// tag's size is in game pixels.
export const previewStyle = (style) => {
  if (style === null) return null;
  if (style.tag === 'Header') return { fontSize: 24, bold: true, italic: false, color: null };
  if (style.tag === 'Bold') return { fontSize: null, bold: true, italic: false, color: null };
  if (style.tag === 'Italic') return { fontSize: null, bold: false, italic: true, color: null };
  return { fontSize: style.size ?? null, bold: style.fontface === 'Bold', italic: style.fontface === 'Italic', color: style.color ?? null };
};

// Whether the message can be applied: not while one is on its way, nothing to apply when it is the server's, nor while a
// rule is broken.
export const canApply = (draft, server, busy = false) => !busy && !sameMessage(draft, server) && validate(draft.lines).length === 0;

// What the bot did, as staff are told.
export const outcomeText = (outcome) => {
  if (outcome === 'unchanged') return 'The server already has this message.';
  if (outcome === 'next-match') return 'Saved — shows from the next match.';
  return 'Saved.';
};
