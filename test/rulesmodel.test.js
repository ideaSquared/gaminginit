import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  draftOf,
  kickParts,
  modeNote,
  ruleProblem,
  sameRule,
  takenWeapons,
  todayText,
  warningParts,
  warningPrefix,
  weaponGroups,
  weaponsOf,
  withoutWeapon,
  withWeapon,
} from '../public/js/rulesmodel.js';

const HUMVEE_M249 = 'Id.Vehicle.WeaponExtension.WHL_05.RingTurret';
const HUMVEE_MINIGUN = 'Id.Vehicle.WeaponExtension.WHL_05.RingMinigun';
const MGL = 'Id.Item.MMGL';
const M113 = ['Vehicle.Variant.Land.Tracked.SpawnVehicle.Lonestar', 'Vehicle.Variant.Land.Tracked.SpawnVehicle.Valkyra'];
const weapons = [
  { name: 'M4', kind: 'weapon', tags: ['Id.Item.M4'] },
  { name: 'MGL-40', kind: 'weapon', tags: [MGL] },
  { name: 'Humvee M249', kind: 'vehicle-weapon', tags: [HUMVEE_M249] },
  { name: 'Humvee minigun', kind: 'vehicle-weapon', tags: [HUMVEE_MINIGUN] },
  { name: 'M113 APC', kind: 'vehicle', tags: M113 },
];
const after = ' | Rules: our Discord at gaminginit.com';
const page = { weapons, after, limits: { warning: 146, kick: 162 }, maxName: 40, maxWeapons: 20, maxWarnings: 5 };
const humvee = {
  id: 'humvee-gunner',
  name: 'Humvee gunner',
  weapons: [HUMVEE_M249, HUMVEE_MINIGUN],
  mode: 'warn-kick',
  warnings: 2,
  warning: 'No kills from the Humvee gun.',
  kick: 'Kills from the Humvee gun',
  changed: null,
};
const mgl = { ...humvee, id: 'mgl', name: 'MGL', weapons: [MGL], mode: 'off' };
const rules = [humvee, mgl];

describe('the messages in game', () => {
  it('starts a warning the way the bot does', () => {
    assert.equal(warningPrefix('warn', 3, 1), 'Warning: ');
    assert.equal(warningPrefix('warn-kick', 1, 2), 'Warning 1 of 2: ');
    assert.equal(warningPrefix('warn-kick', 2, 2), 'Last warning: ');
  });

  it('splits each message into what the bot adds and what staff wrote', () => {
    assert.deepEqual(warningParts({ ...humvee, warning: ' No  kills ' }, after), { before: 'Warning 1 of 2: ', line: 'No kills', after });
    assert.deepEqual(kickParts(humvee, after), { before: '', line: 'Kills from the Humvee gun', after });
  });

  it('says what each mode does', () => {
    assert.match(modeNote('warn-kick', 1), /first offence of the day, then kicks/);
    assert.match(modeNote('warn-kick', 3), /first 3 offences/);
    assert.match(modeNote('off'), /does nothing/);
  });

  it("says what the bot did today, or nothing when it did nothing", () => {
    assert.equal(todayText({ warned: 2, kicked: 1 }), 'Today: 2 warnings, 1 kick');
    assert.equal(todayText({ warned: 0, kicked: 0 }), null);
    assert.equal(todayText(undefined), null);
  });
});

describe('weapons', () => {
  it("finds a rule's weapons from its tags, in the page's order", () => {
    assert.deepEqual(weaponsOf([HUMVEE_MINIGUN, MGL.toUpperCase()], weapons).map((w) => w.name), ['MGL-40', 'Humvee minigun']);
  });

  it('adds and takes out every tag of a weapon', () => {
    const m113 = weapons[4];
    assert.deepEqual(withWeapon([MGL], m113), [MGL, ...M113]);
    assert.deepEqual(withoutWeapon([MGL, ...M113], m113), [MGL]);
  });

  it('matches tags in any case when adding and taking out', () => {
    const mglWeapon = weapons[1];
    assert.deepEqual(withWeapon([MGL.toUpperCase()], mglWeapon), [MGL.toUpperCase()]);
    assert.deepEqual(withoutWeapon([MGL.toUpperCase(), HUMVEE_M249], mglWeapon), [HUMVEE_M249]);
  });

  it('knows which rule has each weapon, apart from the one being edited', () => {
    assert.deepEqual([...takenWeapons(rules, weapons, 'mgl')], [
      ['Humvee M249', 'Humvee gunner'],
      ['Humvee minigun', 'Humvee gunner'],
    ]);
  });

  it('groups the weapons by kind, in order', () => {
    assert.deepEqual(weaponGroups(weapons).map((g) => [g.kind, g.weapons.length]), [
      ['weapon', 2],
      ['vehicle-weapon', 2],
      ['vehicle', 1],
    ]);
  });
});

describe('ruleProblem', () => {
  const fresh = { ...draftOf(null), name: 'Tank', weapons: ['Id.Item.M4'], warning: 'No.' };

  it('passes a rule with nothing wrong', () => {
    assert.equal(ruleProblem(fresh, rules, page), null);
    assert.equal(ruleProblem(draftOf(humvee), rules, page), null);
  });

  it('finds what the bot would refuse', () => {
    assert.match(ruleProblem({ ...fresh, name: ' ' }, rules, page), /Give the rule a name/);
    assert.match(ruleProblem({ ...fresh, name: 'mgl' }, rules, page), /called "mgl" already/);
    assert.match(ruleProblem({ ...fresh, weapons: [] }, rules, page), /at least one weapon/);
    assert.match(ruleProblem({ ...fresh, weapons: [HUMVEE_M249] }, rules, page), /Humvee M249 is in the "Humvee gunner" rule/);
    assert.match(ruleProblem({ ...fresh, warning: '' }, rules, page), /Write the warning/);
    assert.match(ruleProblem({ ...fresh, mode: 'kick' }, rules, page), /Write the reason/);
    assert.match(ruleProblem({ ...fresh, warning: 'x'.repeat(148) }, rules, page), /2 characters too long/);
  });

  it('lets a message the mode does not use be blank', () => {
    assert.equal(ruleProblem({ ...fresh, mode: 'off', warning: '' }, rules, page), null);
  });
});

describe('sameRule', () => {
  it('compares what staff typed, tidied, with the saved rule', () => {
    assert.equal(sameRule({ ...draftOf(humvee), name: ' Humvee gunner ', weapons: [HUMVEE_MINIGUN, HUMVEE_M249] }, humvee), true);
    assert.equal(sameRule({ ...draftOf(humvee), warnings: 3 }, humvee), false);
    assert.equal(sameRule(draftOf(null), null), false);
  });
});
