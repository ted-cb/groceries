/** Default aisle categories seeded for every new account. */
export const DEFAULT_CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'Frozen',
  'Pantry',
  'Beverages',
  'Household',
  'Personal Care',
  'Other',
] as const;

export function defaultCategoryRows(userId: string) {
  return DEFAULT_CATEGORIES.map((name, index) => ({
    userId,
    name,
    sortOrder: index,
    isDefault: true,
  }));
}
