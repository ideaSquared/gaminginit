import { mapKey } from './format.js';

// The Rotations tab's logic, apart from the page: rotations as the editor holds them, what each map is called, and the
// moves drag and drop makes. The bot sends rotations as the server stores them (map, experiences, lighting, zone layout)
// and takes them back the same way.

// Names a rotation can have, as the bot allows: letters, numbers, spaces and a few marks.
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '&()+.-]*$/u;

export const tidyName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');

// Why a name won't do, or null when it will. `taken` are the other rotations' names.
export const nameProblem = (name, { max = 32, taken = [], defaultName = 'Default' } = {}) => {
  const tidy = tidyName(name);
  if (tidy === '') return 'Give it a name.';
  if (tidy.length > max) return `At most ${max} characters.`;
  if (!NAME.test(tidy)) return "Letters, numbers, spaces and - ' & ( ) + . only.";
  const lower = tidy.toLowerCase();
  if (lower === defaultName.toLowerCase()) return `${defaultName} is taken: it plays on every day without a rotation of its own.`;
  if (taken.some((t) => t.toLowerCase() === lower)) return 'Another rotation has that name.';
  return null;
};

// A name not used yet: "Rotation 2", or "Weekend copy".
export const freeName = (base, names) => {
  const used = new Set(names.map((n) => n.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const name = `${base} ${n}`;
    if (!used.has(name.toLowerCase())) return name;
  }
};

let keys = 0;
// Each map in the editor has a key of its own, so it keeps its place and its open options while the list moves.
const nextKey = () => `m${(keys += 1)}`;

const mapOf = (catalog, id) => catalog?.maps.find((m) => m.id === id) ?? null;

// Infantry only and hardcore, by their ids (KOTH_InfantryOnly, KOTH_Hardcore), as the bot knows them.
const MODIFIER = /infantryonly|hardcore/i;

// A map as the editor holds it: the game mode, the modifiers turned on, lighting and zones ('' for the map's own), and any
// experience the editor does not know, kept as it was.
export const toDraft = (entry, catalog) => {
  const map = mapOf(catalog, entry.map);
  const modeIds = new Set((map?.modes ?? []).map((m) => m.id));
  const modifierIds = new Set((map?.modifiers ?? []).map((m) => m.id));
  const isModifier = (id) => modifierIds.has(id) || MODIFIER.test(id);
  const experiences = entry.experiences ?? [];
  // A mode the map's list has, or else the first that is not a modifier, as the server lists the mode first.
  const mode = experiences.find((id) => modeIds.has(id)) ?? experiences.find((id) => !isModifier(id)) ?? '';
  return {
    key: nextKey(),
    map: entry.map,
    mode,
    modifiers: experiences.filter((id) => id !== mode && isModifier(id)),
    extras: experiences.filter((id) => id !== mode && !isModifier(id)),
    lighting: entry.lighting ?? '',
    zone: entry.zoneAlternator ?? '',
  };
};

// A map newly added: its first game mode, nothing else changed.
export const newDraft = (mapId, catalog) => ({
  key: nextKey(),
  map: mapId,
  mode: mapOf(catalog, mapId)?.modes[0]?.id ?? '',
  modifiers: [],
  extras: [],
  lighting: '',
  zone: '',
});

export const copyDraft = (draft) => ({ ...draft, key: nextKey(), modifiers: [...draft.modifiers], extras: [...draft.extras] });

// Back as the bot takes it. The game mode goes first.
export const fromDraft = (draft) => {
  const experiences = [...(draft.mode ? [draft.mode] : []), ...draft.extras, ...draft.modifiers];
  return {
    map: draft.map,
    ...(experiences.length > 0 ? { experiences } : {}),
    ...(draft.lighting ? { lighting: draft.lighting } : {}),
    ...(draft.zone ? { zoneAlternator: draft.zone } : {}),
  };
};

// An entry as it compares: the order of its experiences does not matter.
const entryKey = (entry) => JSON.stringify([entry.map, [...(entry.experiences ?? [])].sort(), entry.lighting ?? '', entry.zoneAlternator ?? '']);

// Whether the editor holds the same maps, in the same order, as these.
export const sameEntries = (drafts, entries) =>
  drafts.length === entries.length && drafts.every((draft, i) => entryKey(fromDraft(draft)) === entryKey(entries[i]));

// Moves the item at `from` so it ends up at `to` (both from 0), as drag and drop or the arrow keys do.
export const move = (list, from, to) => {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
};

export const insert = (list, at, item) => [...list.slice(0, at), item, ...list.slice(at)];

// What a map is called, and the key for its colour.
export const mapLabel = (mapId, catalog) => mapOf(catalog, mapId)?.name ?? FALLBACK_NAMES[mapId] ?? mapId;
export const mapColour = (mapId, catalog) => mapKey(mapLabel(mapId, catalog));

// The map ids players know by another name, for when the bot could not send the catalogue.
const FALLBACK_NAMES = { Kavkazi: 'Bakurani', Europe: 'Ozeti', NorthAmerica: 'Zestafona' };

const nameIn = (items, id) => items?.find((i) => i.id === id)?.name ?? null;

// A zone layout the catalogue does not name goes by the end of its tag: ZoneAlternator.Bakurani.Default.Circle is
// "Circle". An experience id loses its underscores.
const zoneName = (id) => id.split('.').at(-1) ?? id;
const plainId = (id) => id.replace(/_/g, ' ');

// Lighting at a glance: dawn, day, dusk, grey or fog, from its id (DayStartClear, DayLateGrayFog …).
export const lightingIcon = (id) => {
  if (/fog/i.test(id)) return '🌫️';
  if (/gray|grey|overcast|rain/i.test(id)) return '☁️';
  if (/start|early|dawn/i.test(id)) return '🌅';
  if (/end|dusk|night/i.test(id)) return '🌆';
  if (/late/i.test(id)) return '🌇';
  return '☀️';
};

// The labels a map's row shows: its mode, modifiers, lighting and zones, each with a kind for its colour.
export const draftChips = (draft, catalog) => {
  const map = mapOf(catalog, draft.map);
  const chips = [];
  if (draft.mode) chips.push({ kind: 'mode', text: nameIn(map?.modes, draft.mode) ?? nameIn(catalog?.experiences, draft.mode) ?? plainId(draft.mode) });
  for (const id of draft.modifiers) {
    const name = map?.modifiers.find((m) => m.id === id)?.name ?? nameIn(catalog?.experiences, id) ?? plainId(id);
    chips.push({ kind: /hardcore/i.test(id) ? 'hardcore' : 'modifier', text: name });
  }
  for (const id of draft.extras) chips.push({ kind: 'extra', text: nameIn(catalog?.experiences, id) ?? plainId(id) });
  if (draft.lighting) chips.push({ kind: 'lighting', text: `${lightingIcon(draft.lighting)} ${nameIn(catalog?.lightings, draft.lighting) ?? plainId(draft.lighting)}` });
  if (draft.zone) chips.push({ kind: 'zones', text: `${nameIn(map?.zones, draft.zone) ?? zoneName(draft.zone)} zones` });
  return chips;
};

// The days a rotation plays on, short: "Every day", "Weekdays", "Sat, Sun", "Mon–Wed, Fri".
export const daysLabel = (days, weekdays) => {
  if (days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  const key = days.join(',');
  if (key === '0,1,2,3,4') return 'Weekdays';
  if (key === '5,6') return 'Weekend';
  const short = (d) => weekdays[d].slice(0, 3);
  const runs = [];
  for (const d of days) {
    const last = runs.at(-1);
    if (last && d === last[1] + 1) last[1] = d;
    else runs.push([d, d]);
  }
  return runs.map(([a, b]) => (a === b ? short(a) : b === a + 1 ? `${short(a)}, ${short(b)}` : `${short(a)}–${short(b)}`)).join(', ');
};

// The days each rotation plays on, from the week's plan (Monday first).
export const daysOf = (plan, name) => plan.flatMap((n, day) => (n !== null && n.toLowerCase() === name.toLowerCase() ? [day] : []));

// Who put today's rotation on: the week, or a staff member.
export const chosenBy = (current) => {
  if (!current) return '';
  if (current.by === 'schedule') return 'from the week';
  return `picked by ${current.byName ?? 'staff'}`;
};

// What the bot did on the server, after a change: for the message that says so.
export const outcomeText = (outcome, name) => {
  if (!outcome) return '';
  if (outcome.outcome === 'updated') return `${name} is on the server now and plays from the next map.`;
  if (outcome.outcome === 'unchanged') return 'The server already had these maps.';
  return `Couldn't put it on the server yet (${outcome.reason}). The bot tries again every minute.`;
};
