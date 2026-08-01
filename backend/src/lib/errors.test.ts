import { describe, expect, it } from 'vitest';
import {
  AppError,
  conflict,
  notFound,
  unauthorized,
  validationError,
} from './errors';

describe('error helpers', () => {
  it('builds validation errors as 400', () => {
    const err = validationError('Bad input', [{ field: 'name' }]);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ field: 'name' }]);
  });

  it('builds unauthorized as 401', () => {
    const err = unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('builds not found as 404', () => {
    const err = notFound('List not found');
    expect(err.status).toBe(404);
    expect(err.message).toBe('List not found');
  });

  it('builds conflict as 409 for concurrent / duplicate cases', () => {
    const err = conflict('A category with this name already exists');
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});
