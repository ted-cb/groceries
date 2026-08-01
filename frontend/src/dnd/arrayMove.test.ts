import { describe, expect, it } from 'vitest';
import { arrayMove } from './arrayMove';

describe('arrayMove', () => {
  it('moves an item forward', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('moves an item backward', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('returns the same array reference when indexes match', () => {
    const input = ['a', 'b'];
    expect(arrayMove(input, 0, 0)).toBe(input);
  });

  it('returns the original array for out-of-range indexes', () => {
    const input = ['a', 'b'];
    expect(arrayMove(input, -1, 0)).toBe(input);
    expect(arrayMove(input, 0, 5)).toBe(input);
  });
});
