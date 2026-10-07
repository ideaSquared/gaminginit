// The Weapon rules tab's logic, apart from the page: the messages as the game shows them, which weapons a rule can
// take, and what is wrong with a rule before it is sent. The bot checks a rule the same way when it is saved, and sends
// with the page what it puts after each message (`after`) and the longest each message can be (`limits`).

export const MODES = ['off', 'warn', 'warn-kick', 'kick'];

export const MODE_LABELS = { off: 'Off', warn: 'Warn', 'warn-kick': 'Warn, then kick', kick: 'Kick' };

// What each mode does, for under the switch.
export const modeNote = (mode, warnings = 1) => {
  if (mode === 'off') return 'The bot does nothing about these kills.';
  if (mode === 'warn') return 'The bot sends the player the warning in game, privately, each time.';
  if (mode === 'kick') return 'The bot kicks the player with the kick reason. They can rejoin.';
  const first = warnings === 1 ? 'their first offence of the day' : `their first ${warnings} offences of the day`;
  return `The bot warns the player for ${first}, then kicks them for each one after.`;
};

export const warns = (mode) => mode === 'warn' || mode === 'warn-kick';
export const kicks = (mode) => mode === 'kick' || mode === 'warn-kick';

// Before the warning, as the bot sends it.
export const warningPrefix = (mode, offence, warnings) => {
  if (mode !== 'warn-kick') return 'Warning: ';
  return offence >= warnings ? 'Last warning: ' : `Warning ${offence} of ${warnings}: `;
};

// The game shows a message on one line.
export const tidy = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// A rule's warning in game, in its three parts: what the bot adds before it, the warning, and what it adds after.
export const warningParts = (rule, after, offence = 1) => ({
  before: warningPrefix(rule.mode, offence, rule.warnings),
  line: tidy(rule.warning),
  after,
});

export const kickParts = (rule, after) => ({ before: '', line: tidy(rule.kick), after });

// "Today: 2 warnings, 1 kick", or null when the bot did nothing for the rule today.
export const todayText = (today) => {
  const parts = [
    ...(today?.warned ? [`${today.warned} warning${today.warned === 1 ? '' : 's'}`] : []),
    ...(today?.kicked ? [`${today.kicked} kick${today.kicked === 1 ? '' : 's'}`] : []),
  ];
  return parts.length === 0 ? null : `Today: ${parts.join(', ')}`;
};

// The weapons a list of tags covers, in the page's order: a weapon is in when any of its tags is.
export const weaponsOf = (tags, weapons) => {
  const lower = new Set(tags.map((tag) => tag.toLowerCase()));
  return weapons.filter((w) => w.tags.some((tag) => lower.has(tag.toLowerCase())));
};

// Tags with a weapon's added, or taken out. Tags match in any case, as in weaponsOf.
const hasTag = (tags, tag) => tags.some((t) => t.toLowerCase() === tag.toLowerCase());
export const withWeapon = (tags, weapon) => [...tags, ...weapon.tags.filter((tag) => !hasTag(tags, tag))];
export const withoutWeapon = (tags, weapon) => tags.filter((tag) => !hasTag(weapon.tags, tag));

// The rule each weapon is in already, other than the one being edited (`id`), by weapon name.
export const takenWeapons = (rules, weapons, id) => {
  const taken = new Map();
  for (const rule of rules) {
    if (rule.id === id) continue;
    for (const weapon of weaponsOf(rule.weapons, weapons)) taken.set(weapon.name, rule.name);
  }
  return taken;
};

// The weapons by kind, in the order the bot sends them, for the picker.
export const weaponGroups = (weapons) =>
  weapons.reduce((groups, weapon) => {
    const last = groups[groups.length - 1];
    if (last && last.kind === weapon.kind) last.weapons.push(weapon);
    else groups.push({ kind: weapon.kind, weapons: [weapon] });
    return groups;
  }, []);

const listOf = (items) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// What is wrong with a rule being edited, or null when nothing is. `rules` are the saved ones; `page` has the weapons,
// limits and maximums.
export const ruleProblem = (draft, rules, page) => {
  const name = tidy(draft.name);
  if (name === '') return 'Give the rule a name, such as "Humvee gunner".';
  if (name.length > page.maxName) return `A rule's name can be at most ${page.maxName} characters.`;
  const others = rules.filter((r) => r.id !== draft.id);
  if (others.some((r) => r.name.toLowerCase() === name.toLowerCase())) return `There is a rule called "${name}" already.`;
  const picked = weaponsOf(draft.weapons, page.weapons);
  if (picked.length === 0) return 'Pick at least one weapon.';
  if (draft.weapons.length > page.maxWeapons) return `A rule can have at most ${page.maxWeapons} weapons.`;
  for (const other of others) {
    const shared = weaponsOf(other.weapons, picked).map((w) => w.name);
    if (shared.length > 0) return `${listOf(shared)} ${shared.length === 1 ? 'is' : 'are'} in the "${other.name}" rule already.`;
  }
  if (warns(draft.mode) && tidy(draft.warning) === '') return 'Write the warning the bot sends.';
  if (kicks(draft.mode) && tidy(draft.kick) === '') return 'Write the reason the bot gives with the kick.';
  const warning = tidy(draft.warning).length - page.limits.warning;
  if (warning > 0) return `The warning is ${warning} character${warning === 1 ? '' : 's'} too long for the game.`;
  const kick = tidy(draft.kick).length - page.limits.kick;
  if (kick > 0) return `The kick reason is ${kick} character${kick === 1 ? '' : 's'} too long for the game.`;
  return null;
};

// A rule as the page edits it, and as it sends it to be saved.
export const draftOf = (rule) => ({
  id: rule?.id ?? null,
  name: rule?.name ?? '',
  weapons: [...(rule?.weapons ?? [])],
  mode: rule?.mode ?? 'warn',
  warnings: rule?.warnings ?? 1,
  warning: rule?.warning ?? '',
  kick: rule?.kick ?? '',
});

const sameTags = (a, b) => a.length === b.length && a.every((tag) => b.includes(tag));

// Whether a draft says the same as the saved rule (null for a new one, which is never the same).
export const sameRule = (draft, rule) =>
  rule !== null &&
  tidy(draft.name) === rule.name &&
  sameTags(draft.weapons, rule.weapons) &&
  draft.mode === rule.mode &&
  draft.warnings === rule.warnings &&
  tidy(draft.warning) === rule.warning &&
  tidy(draft.kick) === rule.kick;
