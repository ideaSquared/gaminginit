import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { croppedLine } from '../public/js/format.js';
import { rolling } from '../public/js/trends.js';

describe('rolling', () => {
  it('averages each value with the six before it, and leaves a gap a gap', () => {
    assert.deepEqual(rolling([2, 4, 6]), [2, 3, 4]);
    assert.deepEqual(rolling([2, null, 6]), [2, null, 4]);
    assert.deepEqual(rolling([1, 1, 1, 1, 1, 1, 1, 8], 7), [1, 1, 1, 1, 1, 1, 1, 2]);
  });
});

describe('croppedLine', () => {
  const daily = [0, 0, 0, 0, 0, 0, 70, 70].map((v, i) => ({ day: `2026-10-0${i + 1}`, v }));
  it('keeps the average a day had over the whole history when the range starts on it', () => {
    const all = croppedLine(daily, (r) => r.v, null, rolling);
    const last2 = croppedLine(daily, (r) => r.v, 2, rolling);
    assert.equal(all.smooth[6], 10);
    // 70 is the first day of the range, but its average is still over the six zeroes before it.
    assert.equal(last2.points[0].value, 70);
    assert.equal(last2.smooth[0], 10);
    assert.equal(last2.smooth[1], 20);
  });

  it('runs from the first day with a figure to the last', () => {
    const rows = [null, null, 5, null, 7, null].map((v, i) => ({ day: `2026-10-0${i + 1}`, v }));
    const r = croppedLine(rows, (x) => x.v, null, rolling);
    assert.deepEqual(r.points.map((p) => p.value), [5, null, 7]);
    assert.equal(r.smooth.length, 3);
    assert.deepEqual(croppedLine(rows, (x) => x.v, 1, rolling), { points: [], smooth: [] });
  });
});
