import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage, type SyncMutationMeta } from './queryClient';

export type SyncUiStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SyncStatusValue = {
  status: SyncUiStatus;
  message: string | null;
  /** Re-run the last failed tracked mutation, if any. */
  retry: (() => void) | null;
  dismissError: () => void;
  /** Mark a brief "Saved" flash after a successful write. */
  flashSaved: () => void;
  /** Report a conflict/error from a page-level handler. */
  reportError: (message: string, retry?: (() => void) | null) => void;
};

const SyncStatusContext = createContext<SyncStatusValue | null>(null);

const SAVED_FLASH_MS = 2200;

function isTrackedMutation(mutation: {
  options: { meta?: SyncMutationMeta | unknown };
}): boolean {
  const meta = mutation.options.meta as SyncMutationMeta | undefined;
  return meta?.syncTrack !== false;
}

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const isMutating = useIsMutating({
    predicate: (m) => isTrackedMutation(m),
  });

  const [flashSaved, setFlashSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadPendingWrite = useRef(false);

  const clearSavedTimer = useCallback(() => {
    if (savedTimer.current) {
      clearTimeout(savedTimer.current);
      savedTimer.current = null;
    }
  }, []);

  const triggerSavedFlash = useCallback(() => {
    clearSavedTimer();
    setFlashSaved(true);
    setErrorMessage(null);
    setRetryFn(null);
    savedTimer.current = setTimeout(() => {
      setFlashSaved(false);
      savedTimer.current = null;
    }, SAVED_FLASH_MS);
  }, [clearSavedTimer]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    setRetryFn(null);
  }, []);

  const reportError = useCallback((message: string, retry?: (() => void) | null) => {
    setFlashSaved(false);
    setErrorMessage(message);
    setRetryFn(() => retry ?? null);
  }, []);

  // Subscribe to mutation cache for success / error of tracked writes.
  useEffect(() => {
    const cache = queryClient.getMutationCache();

    const unsubscribe = cache.subscribe((event) => {
      if (!event || event.type !== 'updated') return;
      const mutation = event.mutation;
      if (!isTrackedMutation(mutation)) return;

      const state = mutation.state;
      if (state.status === 'success') {
        triggerSavedFlash();
      } else if (state.status === 'error') {
        const message = getErrorMessage(
          state.error,
          'Could not save. Check your connection and try again.'
        );
        const retry = () => {
          void mutation.execute(mutation.state.variables as never);
        };
        setFlashSaved(false);
        setErrorMessage(message);
        setRetryFn(() => retry);
      }
    });

    return () => {
      unsubscribe();
      clearSavedTimer();
    };
  }, [queryClient, triggerSavedFlash, clearSavedTimer]);

  // Clear sticky error while a new write is in flight.
  useEffect(() => {
    if (isMutating > 0) {
      hadPendingWrite.current = true;
      setErrorMessage(null);
    } else if (hadPendingWrite.current) {
      hadPendingWrite.current = false;
    }
  }, [isMutating]);

  const status: SyncUiStatus = useMemo(() => {
    if (errorMessage) return 'error';
    if (isMutating > 0) return 'saving';
    if (flashSaved) return 'saved';
    return 'idle';
  }, [errorMessage, isMutating, flashSaved]);

  const message = useMemo(() => {
    if (status === 'error') return errorMessage;
    if (status === 'saving') return 'Saving…';
    if (status === 'saved') return 'Saved';
    return null;
  }, [status, errorMessage]);

  const value = useMemo<SyncStatusValue>(
    () => ({
      status,
      message,
      retry: retryFn,
      dismissError,
      flashSaved: triggerSavedFlash,
      reportError,
    }),
    [status, message, retryFn, dismissError, triggerSavedFlash, reportError]
  );

  return (
    <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) {
    throw new Error('useSyncStatus must be used within SyncStatusProvider');
  }
  return ctx;
}
