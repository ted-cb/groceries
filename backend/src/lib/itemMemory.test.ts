import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMORY_SEARCH_LIMIT,
  MAX_MEMORY_SEARCH_LIMIT,
  normalizeItemNameKey,
  serializeItemMemory,
} from './itemMemory';

describe('normalizeItemNameKey', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeItemNameKey('  Almond   Milk ')).toBe('almond milk');
  });

  it('treats different casing as the same key', () => {
    expect(normalizeItemNameKey('Milk')).toBe(normalizeItemNameKey('milk'));
    expect(normalizeItemNameKey('MILK')).toBe('milk');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeItemNameKey('   ')).toBe('');
  });
});

describe('search limits', () => {
  it('exposes sensible default and max limits for the API', () => {
    expect(DEFAULT_MEMORY_SEARCH_LIMIT).toBeGreaterThan(0);
    expect(MAX_MEMORY_SEARCH_LIMIT).toBeGreaterThanOrEqual(
      DEFAULT_MEMORY_SEARCH_LIMIT
    );
  });
});

describe('serializeItemMemory', () => {
  it('serializes dates and nested category', () => {
    const lastUsedAt = new Date('2026-08-01T12:00:00.000Z');
    const payload = serializeItemMemory({
      id: 'mem-1',
      name: 'Milk',
      nameKey: 'milk',
      categoryId: 'cat-1',
      useCount: 3,
      lastUsedAt,
      category: { id: 'cat-1', name: 'Dairy', sortOrder: 1 },
    });

    expect(payload).toEqual({
      id: 'mem-1',
      name: 'Milk',
      nameKey: 'milk',
      categoryId: 'cat-1',
      useCount: 3,
      lastUsedAt: '2026-08-01T12:00:00.000Z',
      category: { id: 'cat-1', name: 'Dairy', sortOrder: 1 },
    });
  });
});
