import type { QueryClient } from '@tanstack/react-query';
import {
  getErrorMessage,
  isConflictError,
  isNotFoundError,
  isUnauthorizedError,
} from './queryClient';

type HandleWriteErrorOptions = {
  queryClient: QueryClient;
  /** Query keys to invalidate / refresh after conflict or not-found. */
  invalidateKeys?: unknown[][];
  /** Optional page-level error setter. */
  setError?: (message: string) => void;
  /** Called when the session is no longer valid. */
  onUnauthorized?: () => void;
  fallback?: string;
};

/**
 * Shared handling for failed writes: last-write-wins conflicts refresh data,
 * not-found refreshes caches, network errors surface a clear message.
 */
export function handleWriteError(
  error: unknown,
  options: HandleWriteErrorOptions
): string {
  const {
    queryClient,
    invalidateKeys = [],
    setError,
    onUnauthorized,
    fallback = 'Could not save. Try again.',
  } = options;

  if (isUnauthorizedError(error)) {
    onUnauthorized?.();
    const message = 'Your session expired. Please log in again.';
    setError?.(message);
    return message;
  }

  if (isConflictError(error)) {
    for (const key of invalidateKeys) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    const message = getErrorMessage(
      error,
      'This change conflicted with another update. Latest data was loaded.'
    );
    setError?.(message);
    return message;
  }

  if (isNotFoundError(error)) {
    for (const key of invalidateKeys) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    const message = getErrorMessage(
      error,
      'That item is no longer available. The list was refreshed.'
    );
    setError?.(message);
    return message;
  }

  const message = getErrorMessage(error, fallback);
  setError?.(message);
  return message;
}
