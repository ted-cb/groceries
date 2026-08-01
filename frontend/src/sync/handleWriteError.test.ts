import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { handleWriteError } from './handleWriteError';

function mockQueryClient() {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as QueryClient;
}

describe('handleWriteError', () => {
  it('refreshes caches on conflict (last-write-wins recovery)', () => {
    const queryClient = mockQueryClient();
    const setError = vi.fn();
    const message = handleWriteError(
      new ApiError(409, 'CONFLICT', 'Name taken'),
      {
        queryClient,
        invalidateKeys: [['categories'], ['lists']],
        setError,
      }
    );

    expect(message).toBe('Name taken');
    expect(setError).toHaveBeenCalledWith('Name taken');
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('refreshes caches when a resource was deleted elsewhere', () => {
    const queryClient = mockQueryClient();
    handleWriteError(new ApiError(404, 'NOT_FOUND', 'Item gone'), {
      queryClient,
      invalidateKeys: [['lists', '1', 'items']],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['lists', '1', 'items'],
    });
  });

  it('invokes onUnauthorized for expired sessions', () => {
    const queryClient = mockQueryClient();
    const onUnauthorized = vi.fn();
    const message = handleWriteError(
      new ApiError(401, 'UNAUTHORIZED', 'Authentication required'),
      {
        queryClient,
        onUnauthorized,
      }
    );
    expect(onUnauthorized).toHaveBeenCalled();
    expect(message).toMatch(/session expired/i);
  });

  it('surfaces network failures without invalidating', () => {
    const queryClient = mockQueryClient();
    const setError = vi.fn();
    handleWriteError(new ApiError(0, 'NETWORK_ERROR', 'fail'), {
      queryClient,
      invalidateKeys: [['lists']],
      setError,
      fallback: 'Could not save.',
    });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(
      expect.stringMatching(/network/i)
    );
  });
});
