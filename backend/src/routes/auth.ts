import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../lib/password';
import {
  clearSessionCookie,
  createSession,
  destroySessionByToken,
  setSessionCookie,
  SESSION_COOKIE,
} from '../lib/session';
import { defaultCategoryRows } from '../lib/categories';
import { conflict, unauthorized, validationError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authRouter = Router();

function publicUser(user: { id: string; email: string }) {
  return { id: user.id, email: user.email };
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid registration data', parsed.error.errors);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      throw validationError(strengthError);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash },
      });
      await tx.category.createMany({
        data: defaultCategoryRows(created.id),
      });
      return created;
    });

    const token = await createSession(user.id);
    setSessionCookie(res, token);

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError('Invalid login data', parsed.error.errors);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw unauthorized('Invalid email or password');
    }

    const token = await createSession(user.id);
    setSessionCookie(res, token);

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    await destroySessionByToken(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user!) });
});
