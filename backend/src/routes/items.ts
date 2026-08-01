import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notFound, validationError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';

export const itemsRouter = Router();

itemsRouter.use(requireAuth);

const updateItemSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Item name is required')
      .max(200, 'Item name must be at most 200 characters')
      .optional(),
    categoryId: z.string().uuid('Invalid category id').optional(),
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
    isChecked: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.categoryId !== undefined ||
      data.quantity !== undefined ||
      data.note !== undefined ||
      data.isChecked !== undefined,
    { message: 'Provide at least one field to update' }
  );

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

async function findOwnedItem(itemId: string, userId: string) {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      list: { userId },
    },
    include: itemInclude,
  });
  if (!item) {
    throw notFound('Item not found');
  }
  return item;
}

async function assertOwnedCategory(categoryId: string, userId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) {
    throw validationError('Category not found');
  }
  return category;
}

async function touchList(listId: string) {
  await prisma.list.update({
    where: { id: listId },
    data: { updatedAt: new Date() },
  });
}

/** PATCH /api/items/:itemId — edit fields */
itemsRouter.patch('/:itemId', async (req, res, next) => {
  try {
    const itemId = z.string().uuid().safeParse(req.params.itemId);
    if (!itemId.success) {
      throw validationError('Invalid item id');
    }

    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid item data', parsed.error.errors);
    }

    const existing = await findOwnedItem(itemId.data, req.user!.id);

    if (parsed.data.categoryId !== undefined) {
      await assertOwnedCategory(parsed.data.categoryId, req.user!.id);
    }

    const data: {
      name?: string;
      categoryId?: string;
      quantity?: string | null;
      note?: string | null;
      isChecked?: boolean;
      checkedAt?: Date | null;
    } = {};

    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name;
    }
    if (parsed.data.categoryId !== undefined) {
      data.categoryId = parsed.data.categoryId;
    }
    if (parsed.data.quantity !== undefined) {
      data.quantity =
        parsed.data.quantity === '' || parsed.data.quantity === null
          ? null
          : parsed.data.quantity;
    }
    if (parsed.data.note !== undefined) {
      data.note =
        parsed.data.note === '' || parsed.data.note === null
          ? null
          : parsed.data.note;
    }
    if (parsed.data.isChecked !== undefined) {
      data.isChecked = parsed.data.isChecked;
      data.checkedAt = parsed.data.isChecked ? new Date() : null;
    }

    const item = await prisma.item.update({
      where: { id: itemId.data },
      data,
      include: itemInclude,
    });

    await touchList(existing.listId);

    res.json({ item: serializeItem(item) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/items/:itemId */
itemsRouter.delete('/:itemId', async (req, res, next) => {
  try {
    const itemId = z.string().uuid().safeParse(req.params.itemId);
    if (!itemId.success) {
      throw validationError('Invalid item id');
    }

    const existing = await findOwnedItem(itemId.data, req.user!.id);

    await prisma.item.delete({ where: { id: itemId.data } });
    await touchList(existing.listId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
