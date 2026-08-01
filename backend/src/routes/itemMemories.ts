import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validationError } from '../lib/errors';
import {
  DEFAULT_MEMORY_SEARCH_LIMIT,
  MAX_MEMORY_SEARCH_LIMIT,
  searchItemMemories,
  serializeItemMemory,
} from '../lib/itemMemory';
import { requireAuth } from '../middleware/auth';

export const itemMemoriesRouter = Router();

itemMemoriesRouter.use(requireAuth);

const querySchema = z.object({
  q: z.string().max(200).optional().default(''),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_MEMORY_SEARCH_LIMIT)
    .optional()
    .default(DEFAULT_MEMORY_SEARCH_LIMIT),
});

/**
 * GET /api/item-memories?q=&limit=
 * Search remembered item names for the current user (autocomplete).
 * Empty q returns most recently used memories.
 */
itemMemoriesRouter.get('/', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw validationError('Invalid query parameters', parsed.error.errors);
    }

    const rows = await searchItemMemories(prisma, {
      userId: req.user!.id,
      query: parsed.data.q,
      limit: parsed.data.limit,
    });

    res.json({
      itemMemories: rows.map(serializeItemMemory),
    });
  } catch (err) {
    next(err);
  }
});
