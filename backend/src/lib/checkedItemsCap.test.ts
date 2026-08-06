import { describe, expect, it } from 'vitest';
import { MAX_CHECKED_ITEMS_PER_LIST } from './checkedItemsCap';

describe('checked items cap', () => {
  it('keeps at most 100 crossed-off items per list', () => {
    expect(MAX_CHECKED_ITEMS_PER_LIST).toBe(100);
  });

  it('computes how many oldest rows to drop when over cap', () => {
    const max = MAX_CHECKED_ITEMS_PER_LIST;
    expect(Math.max(0, 100 - max)).toBe(0);
    expect(Math.max(0, 101 - max)).toBe(1);
    expect(Math.max(0, 150 - max)).toBe(50);
  });
});
