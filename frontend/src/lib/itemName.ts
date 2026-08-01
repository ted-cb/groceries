import type { ItemMemory } from '../api/itemMemories';

/** Match backend normalizeItemNameKey for exact-known detection. */
export function normalizeItemNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Prefer an exact nameKey match among search results. */
export function findExactMemory(
  memories: ItemMemory[],
  name: string
): ItemMemory | undefined {
  const key = normalizeItemNameKey(name);
  if (!key) return undefined;
  return memories.find((m) => m.nameKey === key);
}

/**
 * Default category for the first-time category prompt.
 * Prefer "Other", else first category in the list.
 */
export function pickPromptDefaultCategoryId(
  categories: { id: string; name: string }[]
): string {
  if (categories.length === 0) return '';
  const other = categories.find((c) => c.name === 'Other');
  return other?.id ?? categories[0].id;
}
