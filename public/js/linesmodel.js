// The Lines tab's logic, apart from the page: each line as the game shows it, and what is wrong with one. The bot sends
// each list with what it puts before and after its lines (`before`, `after`) and what it fills each placeholder in
// with (`values`), and checks lines the same way when a list is saved.

// The game shows a message on one line.
export const tidyLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

const PLACEHOLDER = /\{(\w+)\}/g;

export const fillLine = (line, values) =>
  String(line).replace(PLACEHOLDER, (whole, name) => (Object.hasOwn(values, name) ? String(values[name]) : whole));

// The message in game with this line, in its three parts: what the bot adds before it, the line filled in, and what
// the bot adds after it.
export const messageParts = (list, line) => ({ before: list.before, line: fillLine(tidyLine(line), list.values), after: list.after });

export const messageLength = (list, line) => {
  const parts = messageParts(list, line);
  return parts.before.length + parts.line.length + parts.after.length;
};

const listOf = (items) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// What is wrong with a line, or null when nothing is (or it is blank, as blank lines are dropped). `max` is the longest
// message the game shows.
export const lineProblem = (list, line, max) => {
  const tidy = tidyLine(line);
  if (tidy === '') return null;
  const unknown = [...new Set([...tidy.matchAll(PLACEHOLDER)].map((m) => m[1]))].filter((name) => !Object.hasOwn(list.values, name));
  if (unknown.length > 0) {
    const known = Object.keys(list.values).map((name) => `{${name}}`);
    const them = listOf(unknown.map((name) => `{${name}}`));
    return `The bot can't fill in ${them} here. ${known.length === 0 ? 'These lines have nothing to fill in.' : `It can fill in ${listOf(known)}.`}`;
  }
  const over = messageLength(list, tidy) - max;
  return over > 0 ? `${over} character${over === 1 ? '' : 's'} too long for the game.` : null;
};

// The lines to send: tidied, without blank ones.
export const linesToSave = (texts) => texts.map(tidyLine).filter((line) => line !== '');

export const sameLines = (a, b) => a.length === b.length && a.every((line, i) => line === b[i]);

// How many of a list's saved lines have something wrong with them now, such as being too long since the bot's settings
// changed.
export const problemCount = (list, max) => list.lines.filter((line) => lineProblem(list, line, max) !== null).length;

// The lists in their groups, in the order the bot sends them.
export const groupLists = (lists) =>
  lists.reduce((groups, list) => {
    const last = groups[groups.length - 1];
    if (last && last.name === list.group) last.lists.push(list);
    else groups.push({ name: list.group, lists: [list] });
    return groups;
  }, []);

// "Halfway: Valkyra", or "Seeding" for a list alone in its group.
export const listLabel = (list) => (list.group === list.name ? list.name : `${list.group}: ${list.name}`);
