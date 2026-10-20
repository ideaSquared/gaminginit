import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rolling } from '../public/js/trends.js';

describe('rolling', () => {
  it('averages each value with the six before it, and leaves a gap a gap', () => {
    assert.deepEqual(rolling([2, 4, 6]), [2, 3, 4]);
    assert.deepEqual(rolling([2, null, 6]), [2, null, 4]);
    assert.deepEqual(rolling([1, 1, 1, 1, 1, 1, 1, 8], 7), [1, 1, 1, 1, 1, 1, 1, 2]);
  });
});
