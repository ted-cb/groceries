import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashToken, SESSION_COOKIE } from '../lib/session';
import { unauthorized } from '../lib/errors';

export type AuthUser = {
  id: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) {
      next(unauthorized());
      return;
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      next(unauthorized('Session expired or invalid'));
      return;
    }

    req.user = { id: session.user.id, email: session.user.email };
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
