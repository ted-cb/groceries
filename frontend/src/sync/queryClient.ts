import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

/** Client errors (4xx) should not auto-retry; network / 5xx may. */
export function shouldRetryRequest(
  failureCount: number,
  error: unknown,
  maxRetries: number
): boolean {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    return failureCount < maxRetries;
  }
  // Network / parse failures
  return failureCount < maxRetries;
}

export function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.code === 'NETWORK_ERROR') {
      return 'Network error. Check your connection and try again.';
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    // Browser TypeError for failed fetch (when not already wrapped)
    if (
      error.name === 'TypeError' ||
      /failed to fetch|networkerror|load failed/i.test(error.message)
    ) {
      return 'Network error. Check your connection and try again.';
    }
    return error.message;
  }
  return fallback;
}

export type SyncMutationMeta = {
  /** When false, mutation is excluded from the global save/sync indicator. Default true. */
  syncTrack?: boolean;
  /** Optional label for status UI (e.g. "item", "list"). */
  syncLabel?: string;
};

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        // Refresh-on-load: treat data as stale so mount / focus / reconnect refetch.
        staleTime: 0,
        gcTime: 5 * 60_000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => shouldRetryRequest(failureCount, error, 2),
      },
      mutations: {
        // Retry transient write failures once (FR-S-09).
        retry: (failureCount, error) => shouldRetryRequest(failureCount, error, 1),
      },
    },
  });
}
