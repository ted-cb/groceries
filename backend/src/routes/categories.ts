import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { conflict, notFound, validationError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Category name is required')
  .max(50, 'Category name must be at most 50 characters');

const createSchema = z.object({
  name: nameSchema,
});

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => data.name !== undefined || data.sortOrder !== undefined, {
    message: 'Provide at least one field to update',
  });

const reorderSchema = z.object({
  orderedIds: z
    .array(z.string().uuid())
    .min(1, 'orderedIds must not be empty'),
});

const deleteSchema = z.object({
  reassignToCategoryId: z.string().uuid('Invalid reassignment category id'),
});

function serializeCategory(category: {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  _count?: { items: number };
}) {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    isDefault: category.isDefault,
    itemCount: category._count?.items ?? 0,
  };
}

async function findOwnedCategory(categoryId: string, userId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    include: { _count: { select: { items: true } } },
  });
  if (!category) {
    throw notFound('Category not found');
  }
  return category;
}

/** GET /api/categories */
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    });

    res.json({ categories: categories.map(serializeCategory) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/categories — create custom category */
categoriesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid category data', parsed.error.errors);
    }

    const name = parsed.data.name;
    const userId = req.user!.id;

    const existing = await prisma.category.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      throw conflict('A category with this name already exists');
    }

    const maxSort = await prisma.category.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const sortOrder =
      maxSort._max.sortOrder === null ? 0 : maxSort._max.sortOrder + 1;

    try {
      const category = await prisma.category.create({
        data: {
          userId,
          name,
          sortOrder,
          isDefault: false,
        },
        include: { _count: { select: { items: true } } },
      });

      res.status(201).json({ category: serializeCategory(category) });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw conflict('A category with this name already exists');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/categories/reorder — set full sort order.
 * Body: { orderedIds: string[] } must include every category for the user exactly once.
 */
categoriesRouter.put('/reorder', async (req, res, next) => {
  try {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid reorder data', parsed.error.errors);
    }

    const userId = req.user!.id;
    const { orderedIds } = parsed.data;

    const owned = await prisma.category.findMany({
      where: { userId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((c) => c.id));

    if (orderedIds.length !== ownedIds.size) {
      throw validationError(
        'orderedIds must include every category exactly once'
      );
    }

    const seen = new Set<string>();
    for (const id of orderedIds) {
      if (!ownedIds.has(id) || seen.has(id)) {
        throw validationError(
          'orderedIds must include every category exactly once'
        );
      }
      seen.add(id);
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    });

    res.json({ categories: categories.map(serializeCategory) });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/categories/:categoryId — rename / set sortOrder */
categoriesRouter.patch('/:categoryId', async (req, res, next) => {
  try {
    const categoryId = z.string().uuid().safeParse(req.params.categoryId);
    if (!categoryId.success) {
      throw validationError('Invalid category id');
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid category data', parsed.error.errors);
    }

    const existing = await findOwnedCategory(categoryId.data, req.user!.id);
    const data: { name?: string; sortOrder?: number } = {};

    if (parsed.data.name !== undefined) {
      const name = parsed.data.name;
      const duplicate = await prisma.category.findFirst({
        where: {
          userId: req.user!.id,
          name: { equals: name, mode: 'insensitive' },
          NOT: { id: existing.id },
        },
      });
      if (duplicate) {
        throw conflict('A category with this name already exists');
      }
      data.name = name;
    }

    if (parsed.data.sortOrder !== undefined) {
      data.sortOrder = parsed.data.sortOrder;
    }

    try {
      const category = await prisma.category.update({
        where: { id: existing.id },
        data,
        include: { _count: { select: { items: true } } },
      });
      res.json({ category: serializeCategory(category) });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw conflict('A category with this name already exists');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/categories/:categoryId
 * Body: { reassignToCategoryId } — required; reassigns items then deletes.
 */
categoriesRouter.delete('/:categoryId', async (req, res, next) => {
  try {
    const categoryId = z.string().uuid().safeParse(req.params.categoryId);
    if (!categoryId.success) {
      throw validationError('Invalid category id');
    }

    const parsed = deleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw validationError(
        'Choose a category to reassign items to',
        parsed.error.errors
      );
    }

    const userId = req.user!.id;
    const existing = await findOwnedCategory(categoryId.data, userId);

    if (parsed.data.reassignToCategoryId === existing.id) {
      throw validationError(
        'Reassignment category must be different from the category being deleted'
      );
    }

    const total = await prisma.category.count({ where: { userId } });
    if (total <= 1) {
      throw validationError('Cannot delete the last remaining category');
    }

    const target = await prisma.category.findFirst({
      where: { id: parsed.data.reassignToCategoryId, userId },
    });
    if (!target) {
      throw validationError('Reassignment category not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.item.updateMany({
        where: { categoryId: existing.id },
        data: { categoryId: target.id },
      });
      // Keep item-memory FKs valid after the category row is removed.
      await tx.itemMemory.updateMany({
        where: { categoryId: existing.id, userId },
        data: { categoryId: target.id },
      });
      await tx.category.delete({ where: { id: existing.id } });
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
