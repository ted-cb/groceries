import { useSyncStatus } from '../sync/SyncStatusContext';

/**
 * Global save/sync indicator (FR-S-08). Fixed to the bottom so it stays visible
 * during shopping without covering primary controls.
 */
export function SyncStatusBar() {
  const { status, message, retry, dismissError } = useSyncStatus();

  if (status === 'idle') {
    return null;
  }

  const role = status === 'error' ? 'alert' : 'status';
  const className = [
    'sync-status-bar',
    status === 'saving' ? 'sync-status-saving' : '',
    status === 'saved' ? 'sync-status-saved' : '',
    status === 'error' ? 'sync-status-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role={role} aria-live="polite" aria-atomic="true">
      <span className="sync-status-dot" aria-hidden />
      <span className="sync-status-message">{message}</span>
      {status === 'error' && (
        <span className="sync-status-actions">
          {retry && (
            <button type="button" className="btn secondary btn-sm" onClick={() => retry()}>
              Retry
            </button>
          )}
          <button
            type="button"
            className="btn secondary btn-sm"
            onClick={dismissError}
            aria-label="Dismiss sync error"
          >
            Dismiss
          </button>
        </span>
      )}
    </div>
  );
}
