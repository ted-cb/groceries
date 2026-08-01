import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './password';

describe('validatePasswordStrength', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePasswordStrength('short')).toMatch(/at least 8/i);
  });

  it('accepts passwords of 8+ characters', () => {
    expect(validatePasswordStrength('longenough')).toBeNull();
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash).not.toContain('correct-horse-battery');
    await expect(verifyPassword(hash, 'correct-horse-battery')).resolves.toBe(
      true
    );
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false for an invalid hash string', async () => {
    await expect(verifyPassword('not-a-valid-hash', 'anything')).resolves.toBe(
      false
    );
  });
});
