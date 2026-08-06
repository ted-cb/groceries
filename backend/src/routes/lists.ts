import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notFound, validationError } from '../lib/errors';
import {
  type DbClient,
  normalizeItemNameKey,
  upsertItemMemory,
} from '../lib/itemMemory';
import { requireAuth } from '../middleware/auth';

/**
 * When re-adding an item name, drop any checked (crossed-off) rows on this list
 * that match the same normalized name so it only appears on the active list.
 */
async function removeMatchingCheckedItems(
  db: DbClient,
  listId: string,
  name: string
): Promise<number> {
  const nameKey = normalizeItemNameKey(name);
  if (!nameKey) return 0;

  const checked = await db.item.findMany({
    where: { listId, isChecked: true },
    select: { id: true, name: true },
  });

  const ids = checked
    .filter((row) => normalizeItemNameKey(row.name) === nameKey)
    .map((row) => row.id);

  if (ids.length === 0) return 0;

  await db.item.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

export const listsRouter = Router();

listsRouter.use(requireAuth);

const createItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be at most 200 characters'),
  categoryId: z.string().uuid('Invalid category id'),
  quantity: z
    .string()
    .trim()
    .max(100, 'Quantity must be at most 100 characters')
    .optional()
    .nullable(),
  note: z
    .string()
    .trim()
    .max(200, 'Note must be at most 200 characters')
    .optional()
    .nullable(),
});

function serializeItem(item: {
  id: string;
  listId: string;
  categoryId: string;
  name: string;
  quantity: string | null;
  note: string | null;
  isChecked: boolean;
  checkedAt: Date | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; sortOrder: number };
}) {
  return {
    id: item.id,
    listId: item.listId,
    categoryId: item.categoryId,
    name: item.name,
    quantity: item.quantity,
    note: item.note,
    isChecked: item.isChecked,
    checkedAt: item.checkedAt?.toISOString() ?? null,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    category: {
      id: item.category.id,
      name: item.category.name,
      sortOrder: item.category.sortOrder,
    },
  };
}

const itemInclude = {
  category: {
    select: { id: true, name: true, sortOrder: true },
  },
} as const;

const createListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'List name is required')
    .max(100, 'List name must be at most 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
});

const updateListSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'List name is required')
      .max(100, 'List name must be at most 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be at most 500 characters')
      .optional()
      .nullable(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Provide at least one field to update',
  });

function listSummary(list: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: { isChecked: boolean }[];
}) {
  const itemCount = list.items.length;
  const uncheckedCount = list.items.filter((item) => !item.isChecked).length;

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    itemCount,
    uncheckedCount,
  };
}

async function findOwnedList(listId: string, userId: string) {
  const list = await prisma.list.findFirst({
    where: { id: listId, userId },
  });
  if (!list) {
    throw notFound('List not found');
  }
  return list;
}

/** GET /api/lists — all lists for the current user with item counts */
listsRouter.get('/', async (req, res, next) => {
  try {
    const lists = await prisma.list.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: { isChecked: true },
        },
      },
    });

    res.json({ lists: lists.map(listSummary) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/lists — create a list */
listsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createListSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid list data', parsed.error.errors);
    }

    const description =
      parsed.data.description === undefined || parsed.data.description === ''
        ? null
        : parsed.data.description;

    const list = await prisma.list.create({
      data: {
        userId: req.user!.id,
        name: parsed.data.name,
        description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: { isChecked: true },
        },
      },
    });

    res.status(201).json({ list: listSummary(list) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/lists/:listId/items — items for a list */
listsRouter.get('/:listId/items', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    await findOwnedList(listId.data, req.user!.id);

    const items = await prisma.item.findMany({
      where: { listId: listId.data },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      include: itemInclude,
    });

    res.json({ items: items.map(serializeItem) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/lists/:listId/items — add an item */
listsRouter.post('/:listId/items', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid item data', parsed.error.errors);
    }

    await findOwnedList(listId.data, req.user!.id);

    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: req.user!.id },
    });
    if (!category) {
      throw validationError('Category not found');
    }

    const maxSort = await prisma.item.aggregate({
      where: {
        listId: listId.data,
        categoryId: parsed.data.categoryId,
      },
      _max: { sortOrder: true },
    });
    const nextSort =
      maxSort._max.sortOrder === null ? 0 : maxSort._max.sortOrder + 1;

    const quantity =
      parsed.data.quantity === undefined ||
      parsed.data.quantity === null ||
      parsed.data.quantity === ''
        ? null
        : parsed.data.quantity;
    const note =
      parsed.data.note === undefined ||
      parsed.data.note === null ||
      parsed.data.note === ''
        ? null
        : parsed.data.note;

    const item = await prisma.$transaction(async (tx) => {
      // Re-adding a name should not leave a crossed-off duplicate of the same item.
      await removeMatchingCheckedItems(tx, listId.data, parsed.data.name);

      const created = await tx.item.create({
        data: {
          listId: listId.data,
          categoryId: parsed.data.categoryId,
          name: parsed.data.name,
          quantity,
          note,
          sortOrder: nextSort,
        },
        include: itemInclude,
      });
      await tx.list.update({
        where: { id: listId.data },
        data: { updatedAt: new Date() },
      });
      await upsertItemMemory(tx, {
        userId: req.user!.id,
        name: created.name,
        categoryId: created.categoryId,
      });
      return created;
    });

    res.status(201).json({ item: serializeItem(item) });
  } catch (err) {
    next(err);
  }
});

const reorderItemsSchema = z.object({
  orderedIds: z
    .array(z.string().uuid())
    .min(1, 'orderedIds must not be empty'),
});

/**
 * PUT /api/lists/:listId/items/reorder — set sortOrder for a subset of items.
 * Body: { orderedIds: string[] } — all IDs must belong to this list.
 * Typically used for items within one category (same checked state).
 * Items not listed keep their existing sortOrder.
 */
listsRouter.put('/:listId/items/reorder', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    const parsed = reorderItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid reorder data', parsed.error.errors);
    }

    await findOwnedList(listId.data, req.user!.id);

    const { orderedIds } = parsed.data;
    const uniqueIds = new Set(orderedIds);
    if (uniqueIds.size !== orderedIds.length) {
      throw validationError('orderedIds must not contain duplicates');
    }

    const owned = await prisma.item.findMany({
      where: {
        listId: listId.data,
        id: { in: orderedIds },
      },
      select: { id: true },
    });

    if (owned.length !== orderedIds.length) {
      throw validationError(
        'orderedIds must only include items from this list'
      );
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx.item.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );
      await tx.list.update({
        where: { id: listId.data },
        data: { updatedAt: new Date() },
      });
    });

    const items = await prisma.item.findMany({
      where: { listId: listId.data },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      include: itemInclude,
    });

    res.json({ items: items.map(serializeItem) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/lists/:listId/items/clear-checked — delete all checked items */
listsRouter.post('/:listId/items/clear-checked', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    await findOwnedList(listId.data, req.user!.id);

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.item.deleteMany({
        where: {
          listId: listId.data,
          isChecked: true,
        },
      });
      if (deleted.count > 0) {
        await tx.list.update({
          where: { id: listId.data },
          data: { updatedAt: new Date() },
        });
      }
      return deleted;
    });

    res.json({ deletedCount: result.count });
  } catch (err) {
    next(err);
  }
});

/** GET /api/lists/:listId — list metadata */
listsRouter.get('/:listId', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    const list = await prisma.list.findFirst({
      where: { id: listId.data, userId: req.user!.id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: { isChecked: true },
        },
      },
    });

    if (!list) {
      throw notFound('List not found');
    }

    res.json({ list: listSummary(list) });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/lists/:listId — rename / update description */
listsRouter.patch('/:listId', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    const parsed = updateListSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid list data', parsed.error.errors);
    }

    await findOwnedList(listId.data, req.user!.id);

    const data: { name?: string; description?: string | null } = {};
    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name;
    }
    if (parsed.data.description !== undefined) {
      data.description =
        parsed.data.description === '' ? null : parsed.data.description;
    }

    const list = await prisma.list.update({
      where: { id: listId.data },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: { isChecked: true },
        },
      },
    });

    res.json({ list: listSummary(list) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/lists/:listId — delete list and cascade items */
listsRouter.delete('/:listId', async (req, res, next) => {
  try {
    const listId = z.string().uuid().safeParse(req.params.listId);
    if (!listId.success) {
      throw validationError('Invalid list id');
    }

    await findOwnedList(listId.data, req.user!.id);

    await prisma.list.delete({
      where: { id: listId.data },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
