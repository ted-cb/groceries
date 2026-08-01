import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import {
  getErrorMessage,
  isConflictError,
  isNotFoundError,
  shouldRetryRequest,
} from './queryClient';

describe('shouldRetryRequest', () => {
  it('does not retry 4xx client errors', () => {
    const err = new ApiError(400, 'VALIDATION_ERROR', 'Bad');
    expect(shouldRetryRequest(0, err, 2)).toBe(false);
  });

  it('retries network errors (status 0)', () => {
    const err = new ApiError(0, 'NETWORK_ERROR', 'failed');
    expect(shouldRetryRequest(0, err, 2)).toBe(true);
    expect(shouldRetryRequest(2, err, 2)).toBe(false);
  });

  it('retries 5xx server errors within the limit', () => {
    const err = new ApiError(503, 'INTERNAL_ERROR', 'Down');
    expect(shouldRetryRequest(0, err, 1)).toBe(true);
    expect(shouldRetryRequest(1, err, 1)).toBe(false);
  });
});

describe('error classification', () => {
  it('detects conflict and not-found', () => {
    expect(isConflictError(new ApiError(409, 'CONFLICT', 'dup'))).toBe(true);
    expect(isNotFoundError(new ApiError(404, 'NOT_FOUND', 'gone'))).toBe(true);
    expect(isConflictError(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toBe(
      false
    );
  });

  it('maps network errors to a friendly message', () => {
    const err = new ApiError(0, 'NETWORK_ERROR', 'Failed to fetch');
    expect(getErrorMessage(err, 'fallback')).toMatch(/network/i);
  });

  it('prefers API error messages for domain failures', () => {
    const err = new ApiError(409, 'CONFLICT', 'Name already exists');
    expect(getErrorMessage(err, 'fallback')).toBe('Name already exists');
  });
});
