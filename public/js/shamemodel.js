import { daysAgo, utcDay } from './format.js';

// What the hall of shame says about the bot's /api/shame, with no DOM so it can be tested. It is a bit of fun, so it
// teases about the team kills and keeps to the facts for the kicks and bans: no reasons, and nobody is called names.

// A player needs this many team kill warnings to be listed (the bot's own minimum), and the title they earn at each count.
export const TEAM_KILL_TITLES = [
  { from: 3, title: 'Friendly fire apprentice' },
  { from: 5, title: 'Collateral damage enthusiast' },
  { from: 8, title: 'Their own team’s worst enemy' },
  { from: 12, title: 'Walking friendly-fire incident' },
  { from: 20, title: 'Honorary enemy combatant' },
];

export const teamKillTitle = (warnings) => TEAM_KILL_TITLES.findLast((t) => warnings >= t.from)?.title ?? '';

// The lists of people shown the door, worst first.
export const REMOVED_GROUPS = [
  { outcome: 'kicked-then-banned', heading: 'Kicked, then banned', note: 'Kicked once, took it as a suggestion, and came back for a ban.' },
  { outcome: 'banned', heading: 'Banned', note: 'Straight to the ban.' },
  { outcome: 'kicked', heading: 'Kicked', note: 'Shown the door, for now.' },
];

export const removedGroups = (removed) =>
  REMOVED_GROUPS.map((group) => ({ ...group, players: removed.filter((p) => p.outcome === group.outcome) }));

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

// The small print beside a name: a lifted ban, and team kill warnings they had on top.
export const removedNotes = (player) => [
  ...(player.unbanned ? ['Ban lifted'] : []),
  ...(player.teamKillWarnings > 0 ? [`${plural(player.teamKillWarnings, 'team kill warning')} too`] : []),
];

export const shameTiles = (totals) => [
  { label: 'Team kill warnings', value: String(totals.teamKillWarnings), sub: 'handed out by the bot and staff' },
  { label: 'Players warned', value: String(totals.warned), sub: 'for team killing' },
  { label: 'Players kicked', value: String(totals.kicked), sub: 'shown the door' },
  { label: 'Players banned', value: String(totals.banned), sub: 'not coming back (some did)' },
];

// "Today", "Yesterday" or "5 days ago", by UTC day like the rest of the site.
export const whenText = (at, now) => daysAgo(utcDay(at), utcDay(now));

// How wide a warnings bar is, as a percentage of the most warned player's.
export const barWidth = (warnings, most) => (most <= 0 ? 0 : Math.max(4, Math.round((warnings / most) * 100)));
