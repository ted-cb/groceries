import type { Prisma, PrismaClient } from '@prisma/client';

/** DB client or interactive transaction client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_MEMORY_SEARCH_LIMIT = 12;
export const MAX_MEMORY_SEARCH_LIMIT = 30;

/** Normalize item names for uniqueness and case-insensitive match. */
export function normalizeItemNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type MemorySearchResult = {
  id: string;
  name: string;
  nameKey: string;
  categoryId: string;
  useCount: number;
  lastUsedAt: Date;
  category: { id: string; name: string; sortOrder: number };
};

/**
 * Upsert remembered item → category for a user.
 * Same normalized name updates category, bumps use_count, and refreshes last_used_at.
 */
export async function upsertItemMemory(
  db: DbClient,
  input: {
    userId: string;
    name: string;
    categoryId: string;
  }
): Promise<void> {
  const name = input.name.trim();
  if (!name) return;

  const nameKey = normalizeItemNameKey(name);
  if (!nameKey) return;

  const now = new Date();

  await db.itemMemory.upsert({
    where: {
      userId_nameKey: {
        userId: input.userId,
        nameKey,
      },
    },
    create: {
      userId: input.userId,
      name,
      nameKey,
      categoryId: input.categoryId,
      useCount: 1,
      lastUsedAt: now,
    },
    update: {
      name,
      categoryId: input.categoryId,
      useCount: { increment: 1 },
      lastUsedAt: now,
    },
  });
}

/**
 * Search a user's item memories by substring (case-insensitive via nameKey).
 * Ranking: prefix matches first, then higher useCount, then recent lastUsedAt.
 */
export async function searchItemMemories(
  db: DbClient,
  input: {
    userId: string;
    query?: string;
    limit?: number;
  }
): Promise<MemorySearchResult[]> {
  const limit = Math.min(
    Math.max(input.limit ?? DEFAULT_MEMORY_SEARCH_LIMIT, 1),
    MAX_MEMORY_SEARCH_LIMIT
  );

  const raw = (input.query ?? '').trim();
  const nameKeyQuery = normalizeItemNameKey(raw);

  const where: Prisma.ItemMemoryWhereInput = {
    userId: input.userId,
  };

  if (nameKeyQuery) {
    where.nameKey = { contains: nameKeyQuery };
  }

  // Fetch a bit extra so we can re-rank prefix vs substring in app code.
  const fetchLimit = Math.min(limit * 3, MAX_MEMORY_SEARCH_LIMIT * 2);

  const rows = await db.itemMemory.findMany({
    where,
    include: {
      category: {
        select: { id: true, name: true, sortOrder: true },
      },
    },
    orderBy: [{ lastUsedAt: 'desc' }, { useCount: 'desc' }],
    take: fetchLimit,
  });

  if (!nameKeyQuery) {
    return rows.slice(0, limit);
  }

  const ranked = [...rows].sort((a, b) => {
    const aPrefix = a.nameKey.startsWith(nameKeyQuery) ? 0 : 1;
    const bPrefix = b.nameKey.startsWith(nameKeyQuery) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
  });

  return ranked.slice(0, limit);
}

export function serializeItemMemory(row: MemorySearchResult) {
  return {
    id: row.id,
    name: row.name,
    nameKey: row.nameKey,
    categoryId: row.categoryId,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt.toISOString(),
    category: {
      id: row.category.id,
      name: row.category.name,
      sortOrder: row.category.sortOrder,
    },
  };
}
