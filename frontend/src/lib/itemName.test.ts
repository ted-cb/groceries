import { describe, expect, it } from 'vitest';
import {
  findExactMemory,
  normalizeItemNameKey,
  pickPromptDefaultCategoryId,
} from './itemName';
import type { ItemMemory } from '../api/itemMemories';

function memory(
  partial: Pick<ItemMemory, 'id' | 'name' | 'nameKey' | 'categoryId'>
): ItemMemory {
  return {
    ...partial,
    useCount: 1,
    lastUsedAt: new Date().toISOString(),
    category: {
      id: partial.categoryId,
      name: 'Cat',
      sortOrder: 0,
    },
  };
}

describe('normalizeItemNameKey', () => {
  it('matches server-style normalization', () => {
    expect(normalizeItemNameKey('  Greek   Yogurt ')).toBe('greek yogurt');
  });
});

describe('findExactMemory', () => {
  const rows = [
    memory({
      id: '1',
      name: 'Milk',
      nameKey: 'milk',
      categoryId: 'dairy',
    }),
    memory({
      id: '2',
      name: 'Almond milk',
      nameKey: 'almond milk',
      categoryId: 'dairy',
    }),
  ];

  it('returns the exact nameKey match, not a substring-only hit', () => {
    expect(findExactMemory(rows, 'milk')?.id).toBe('1');
    expect(findExactMemory(rows, 'MILK')?.id).toBe('1');
    expect(findExactMemory(rows, 'Almond milk')?.id).toBe('2');
  });

  it('returns undefined when nothing matches exactly', () => {
    expect(findExactMemory(rows, 'mil')).toBeUndefined();
    expect(findExactMemory(rows, 'butter')).toBeUndefined();
  });
});

describe('pickPromptDefaultCategoryId', () => {
  it('prefers Other when present', () => {
    expect(
      pickPromptDefaultCategoryId([
        { id: 'p', name: 'Produce' },
        { id: 'o', name: 'Other' },
      ])
    ).toBe('o');
  });

  it('falls back to the first category', () => {
    expect(
      pickPromptDefaultCategoryId([{ id: 'p', name: 'Produce' }])
    ).toBe('p');
  });
});
