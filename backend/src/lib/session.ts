import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionExpiryDate(from: Date = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + SESSION_DAYS);
  return expires;
}

/**
 * Secure cookies are only sent over HTTPS.
 * Honor COOKIE_SECURE explicitly — do not force Secure from NODE_ENV alone.
 * Production Docker on HTTP (home LAN / bare port) must set COOKIE_SECURE=false
 * or the browser will drop the session cookie after login.
 */
export function isCookieSecure(): boolean {
  return process.env.COOKIE_SECURE === 'true';
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isCookieSecure(),
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: sessionExpiryDate(),
    },
  });
  return token;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isCookieSecure(),
    path: '/',
  });
}

export async function destroySessionByToken(
  token: string | undefined
): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}
