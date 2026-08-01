import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, defaultCategoryRows } from './categories';

describe('default categories', () => {
  it('includes the expected default aisle set', () => {
    expect(DEFAULT_CATEGORIES).toContain('Produce');
    expect(DEFAULT_CATEGORIES).toContain('Other');
    expect(DEFAULT_CATEGORIES).toHaveLength(10);
  });

  it('builds ordered seed rows for a user', () => {
    const userId = 'user-123';
    const rows = defaultCategoryRows(userId);

    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(rows[0]).toMatchObject({
      userId,
      name: 'Produce',
      sortOrder: 0,
      isDefault: true,
    });
    expect(rows[rows.length - 1]).toMatchObject({
      name: 'Other',
      sortOrder: DEFAULT_CATEGORIES.length - 1,
      isDefault: true,
    });

    const orders = rows.map((r) => r.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
