import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chosenBy,
  daysLabel,
  daysOf,
  draftChips,
  freeName,
  fromDraft,
  insert,
  lightingIcon,
  lightingName,
  zoneName,
  mapColour,
  mapLabel,
  move,
  nameProblem,
  newDraft,
  outcomeText,
  playingRotation,
  sameEntries,
  sameOrder,
  serverSpot,
  toDraft,
} from '../public/js/rotationmodel.js';

const catalog = {
  maps: [
    {
      id: 'Kavkazi',
      name: 'Bakurani',
      modes: [{ id: 'Kavkazi_KOTH_01', name: 'King of the Hill' }],
      modifiers: [
        { key: 'infantry_only', name: 'Infantry only', id: 'KOTH_InfantryOnly' },
        { key: 'hardcore', name: 'Hardcore', id: 'KOTH_Hardcore' },
      ],
      zones: [{ id: 'ZoneAlternator.Bakurani.Default.Circle', name: 'Circle' }],
    },
  ],
  lightings: [{ id: 'DayEndClear', name: 'Dusk, clear' }],
  experiences: [{ id: 'Special_Event', name: 'Special event' }],
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

describe('rotation names', () => {
  it('takes a short name of letters, numbers and a few marks that no other rotation has', () => {
    assert.equal(nameProblem('Weekend mix'), null);
    assert.equal(nameProblem('  '), 'Give it a name.');
    assert.equal(nameProblem('x'.repeat(33)), 'At most 32 characters.');
    assert.match(nameProblem('**bold**'), /Letters, numbers/);
    assert.match(nameProblem('default'), /Default is taken/);
    assert.equal(nameProblem('weekend', { taken: ['Weekend'] }), 'Another rotation has that name.');
  });

  it('finds a name not used yet', () => {
    assert.equal(freeName('New rotation', ['Default']), 'New rotation');
    assert.equal(freeName('Weekend copy', ['weekend copy', 'Weekend copy 2']), 'Weekend copy 3');
  });
});

describe('a map in the editor', () => {
  it('splits a map into its mode, modifiers, lighting and zones, and back the same', () => {
    const entry = { map: 'Kavkazi', experiences: ['Kavkazi_KOTH_01', 'KOTH_Hardcore'], lighting: 'DayEndClear', zoneAlternator: 'ZoneAlternator.Bakurani.Default.Circle' };
    const draft = toDraft(entry, catalog);
    assert.equal(draft.mode, 'Kavkazi_KOTH_01');
    assert.deepEqual(draft.modifiers, ['KOTH_Hardcore']);
    assert.equal(draft.zone, 'ZoneAlternator.Bakurani.Default.Circle');
    assert.deepEqual(fromDraft(draft), entry);
  });

  it('keeps an experience it does not know, and reads the mode without the catalogue', () => {
    const draft = toDraft({ map: 'Kavkazi', experiences: ['Kavkazi_KOTH_01', 'Special_Event', 'KOTH_InfantryOnly'] }, null);
    assert.equal(draft.mode, 'Kavkazi_KOTH_01');
    assert.deepEqual(draft.extras, ['Special_Event']);
    assert.deepEqual(draft.modifiers, ['KOTH_InfantryOnly']);
    assert.deepEqual(fromDraft(draft).experiences, ['Kavkazi_KOTH_01', 'Special_Event', 'KOTH_InfantryOnly']);
  });

  it("starts a new map on its first mode, and the rest the map's own", () => {
    assert.deepEqual(fromDraft(newDraft('Kavkazi', catalog)), { map: 'Kavkazi', experiences: ['Kavkazi_KOTH_01'] });
    assert.deepEqual(fromDraft(newDraft('Europe', catalog)), { map: 'Europe' });
    assert.notEqual(newDraft('Kavkazi', catalog).key, newDraft('Kavkazi', catalog).key);
  });

  it('labels the map with chips for what is set', () => {
    const draft = toDraft({ map: 'Kavkazi', experiences: ['Kavkazi_KOTH_01', 'KOTH_InfantryOnly', 'KOTH_Hardcore', 'Special_Event'], lighting: 'DayEndClear', zoneAlternator: 'ZoneAlternator.Bakurani.Default.Line' }, catalog);
    assert.deepEqual(draftChips(draft, catalog), [
      { kind: 'mode', text: 'King of the Hill' },
      { kind: 'modifier', text: 'Infantry only' },
      { kind: 'hardcore', text: 'Hardcore' },
      { kind: 'extra', text: 'Special event' },
      { kind: 'lighting', text: '🌆 Dusk, clear' },
      { kind: 'zones', text: 'Line zones' },
    ]);
    assert.equal(mapLabel('Kavkazi', catalog), 'Bakurani');
    assert.equal(mapLabel('NorthAmerica', null), 'Zestafona');
    assert.equal(mapColour('Europe', null), 'ozeti');
    assert.equal(mapColour('Elsewhere', null), null);
  });

  it('gives lighting an icon from its id', () => {
    assert.equal(lightingIcon('DayStartClear'), '🌅');
    assert.equal(lightingIcon('DayClear'), '☀️');
    assert.equal(lightingIcon('DayEarlyClear'), '☀️');
    assert.equal(lightingIcon('DayLateGrayFog'), '🌫️');
    assert.equal(lightingIcon('DayLateGray'), '☁️');
    assert.equal(lightingIcon('DayLateRain'), '🌧️');
  });
});

describe('changes', () => {
  it('moves and inserts maps as drag and drop does', () => {
    assert.deepEqual(move(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
    assert.deepEqual(move(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
    assert.deepEqual(move(['a', 'b'], 1, 9), ['a', 'b']);
    assert.deepEqual(insert(['a', 'b'], 1, 'x'), ['a', 'x', 'b']);
  });

  it('knows when the editor holds the saved maps, whatever order their experiences are in', () => {
    const saved = [{ map: 'Kavkazi', experiences: ['KOTH_Hardcore', 'Kavkazi_KOTH_01'] }, { map: 'Europe' }];
    const drafts = saved.map((e) => toDraft(e, catalog));
    assert.equal(sameEntries(drafts, saved), true);
    assert.equal(sameEntries(move(drafts, 0, 1), saved), false);
    assert.equal(sameEntries([{ ...drafts[0], lighting: 'DayEndClear' }, drafts[1]], saved), false);
  });
});

describe('where the server is', () => {
  const server = {
    enabled: true,
    mode: 'ordered',
    entries: [
      { map: 'Europe', status: null },
      { map: 'Kavkazi', experiences: ['Kavkazi_KOTH_01'], lighting: 'DayStartClear', status: 'now' },
      { map: 'NorthAmerica', status: 'next' },
    ],
  };

  it('finds the map being played and the next in the server\'s rotation', () => {
    assert.deepEqual(serverSpot(server), { now: 1, next: 2, total: 3 });
    assert.deepEqual(serverSpot({ ...server, entries: server.entries.map((e) => ({ ...e, status: null })) }), { now: null, next: null, total: 3 });
    assert.deepEqual(serverSpot(null), { now: null, next: null, total: 0 });
  });

  it('matches maps to the server\'s by the maps and their order, not their setup', () => {
    const saved = [{ map: 'Europe' }, { map: 'Kavkazi' }, { map: 'NorthAmerica', lighting: 'DayEndClear' }];
    assert.equal(sameOrder(saved, server), true);
    assert.equal(sameOrder(saved.map((e) => toDraft(e, catalog)), server), true);
    assert.equal(sameOrder(move(saved, 0, 2), server), false);
    assert.equal(sameOrder(saved.slice(0, 2), server), false);
    assert.equal(sameOrder(saved, null), false);
    assert.equal(sameOrder([], { ...server, entries: [] }), false);
  });

  it('finds the saved rotation the server is playing, today\'s first when two have its maps', () => {
    const maps = [{ map: 'Europe' }, { map: 'Kavkazi' }, { map: 'NorthAmerica' }];
    const rotations = [
      { name: 'Default', entries: [{ map: 'Kavkazi' }] },
      { name: 'Weekend', entries: maps },
      { name: 'Weekend dusk', entries: maps },
    ];
    assert.equal(playingRotation(rotations, server)?.name, 'Weekend');
    assert.equal(playingRotation(rotations, server, 'weekend dusk')?.name, 'Weekend dusk');
    assert.equal(playingRotation(rotations.slice(0, 1), server), null);
    assert.equal(playingRotation(rotations, null), null);
  });
});

describe('the week', () => {
  it('says the days a rotation plays on, short', () => {
    const plan = ['Default', 'Default', 'Default', 'Default', 'Night', 'Weekend', 'Weekend'];
    assert.deepEqual(daysOf(plan, 'weekend'), [5, 6]);
    assert.equal(daysLabel(daysOf(plan, 'Default'), WEEKDAYS), 'Mon–Thu');
    assert.equal(daysLabel([5, 6], WEEKDAYS), 'Weekend');
    assert.equal(daysLabel([0, 1, 2, 3, 4], WEEKDAYS), 'Weekdays');
    assert.equal(daysLabel([0, 1, 3], WEEKDAYS), 'Mon, Tue, Thu');
    assert.equal(daysLabel([0, 1, 2, 3, 4, 5, 6], WEEKDAYS), 'Every day');
    assert.equal(daysLabel([], WEEKDAYS), '');
  });

  it('says who put today\'s rotation on, and what the server did', () => {
    assert.equal(chosenBy({ by: 'schedule' }), 'from the week');
    assert.equal(chosenBy({ by: '42', byName: 'Sarge' }), 'picked by Sarge');
    assert.equal(outcomeText({ outcome: 'updated' }, 'Weekend'), 'Weekend is on the server now and plays from the next map.');
    assert.match(outcomeText({ outcome: 'failed', reason: 'read-only' }, 'Weekend'), /\(read-only\)\. The bot tries again/);
    assert.equal(outcomeText(undefined, 'Weekend'), '');
  });
});

describe('lightingName and zoneName', () => {
  it('name an id the catalogue does not list', () => {
    assert.equal(lightingName('DayStartClear'), 'Dawn, clear');
    assert.equal(lightingName('DayLateGrayFog'), 'Afternoon, overcast, fog');
    assert.equal(lightingName('DayLateRain'), 'Afternoon, rain');
    assert.equal(lightingName('NightStorm'), 'Night, storm');
    assert.equal(zoneName('ZoneAlternator.Bakurani.Default.Circle'), 'Circle');
    assert.equal(zoneName('ZoneAlternator.Ozeti.Default.NorthSouthLine'), 'North South Line');
    assert.equal(zoneName('ZoneAlternator.Bakurani.Night.Circle'), 'Night Circle');
  });
});
