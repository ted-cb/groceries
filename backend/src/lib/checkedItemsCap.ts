import type { DbClient } from './itemMemory';

/** Max checked (crossed-off) items retained per list; oldest are pruned. */
export const MAX_CHECKED_ITEMS_PER_LIST = 100;

/**
 * Keep at most maxChecked checked items for a list.
 * Deletes the oldest by checkedAt (then id) when over the cap.
 * @returns number of items deleted
 */
export async function pruneCheckedItemsOverCap(
  db: DbClient,
  listId: string,
  maxChecked: number = MAX_CHECKED_ITEMS_PER_LIST
): Promise<number> {
  const checkedCount = await db.item.count({
    where: { listId, isChecked: true },
  });
  const excess = checkedCount - maxChecked;
  if (excess <= 0) return 0;

  const oldest = await db.item.findMany({
    where: { listId, isChecked: true },
    orderBy: [{ checkedAt: 'asc' }, { id: 'asc' }],
    take: excess,
    select: { id: true },
  });

  if (oldest.length === 0) return 0;

  await db.item.deleteMany({
    where: { id: { in: oldest.map((row) => row.id) } },
  });

  return oldest.length;
}
