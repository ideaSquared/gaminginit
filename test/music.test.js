import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arpeggio, frequency, PROGRESSION } from '../public/js/music.js';

describe('music', () => {
  it('turns MIDI notes into frequencies', () => {
    assert.equal(frequency(69), 440);
    assert.equal(frequency(81), 880);
    assert.ok(Math.abs(frequency(60) - 261.63) < 0.01);
  });

  it('has a chord for each bar, root first, in an order that loops', () => {
    assert.equal(PROGRESSION.length, 4);
    for (const chord of PROGRESSION) {
      assert.equal(chord.length, 4);
      assert.ok(chord.every(Number.isInteger));
    }
  });

  it('gives the arpeggio one note for each eighth of a bar, from the chord, two octaves up', () => {
    for (const chord of PROGRESSION) {
      const notes = arpeggio(chord);
      assert.equal(notes.length, 8);
      assert.ok(notes.every((n) => chord.map((c) => c + 24).includes(n)));
    }
  });
});
