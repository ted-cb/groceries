import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import * as listsApi from '../api/lists';
import type { GroceryList } from '../api/lists';
import { Modal } from '../components/Modal';
import { handleWriteError } from '../sync/handleWriteError';

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) {
    const mins = Math.floor(diffMs / minute);
    return `${mins} min ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours}h ago`;
  }
  if (diffMs < 7 * day) {
    const days = Math.floor(diffMs / day);
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function itemCountLabel(list: GroceryList): string {
  if (list.itemCount === 0) return 'No items yet';
  // Phase D: checked items are removed, so remaining count is the list size.
  return `${list.itemCount} item${list.itemCount === 1 ? '' : 's'}`;
}

type ModalMode = { type: 'create' } | { type: 'rename'; list: GroceryList } | null;

export function HomePage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroceryList | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameFieldId = useId();
  const descFieldId = useId();

  const listsQuery = useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const data = await listsApi.getLists();
      return data.lists;
    },
  });

  const createMutation = useMutation({
    mutationFn: listsApi.createList,
    meta: { syncTrack: true, syncLabel: 'list' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; description?: string | null }) =>
      listsApi.updateList(id, input),
    meta: { syncTrack: true, syncLabel: 'list' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listsApi.deleteList(id),
    meta: { syncTrack: true, syncLabel: 'list' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
    onError: (err) => {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['lists']],
      });
    },
  });

  useEffect(() => {
    if (modal) {
      setFormError(null);
      if (modal.type === 'create') {
        setFormName('');
        setFormDescription('');
      } else {
        setFormName(modal.list.name);
        setFormDescription(modal.list.description ?? '');
      }
      // Focus after paint
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [modal]);

  function openCreate() {
    setModal({ type: 'create' });
  }

  function openRename(list: GroceryList) {
    setModal({ type: 'rename', list });
  }

  function closeModal() {
    if (createMutation.isPending || updateMutation.isPending) return;
    setModal(null);
    setFormError(null);
  }

  async function onSubmitModal(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError('List name is required');
      return;
    }
    if (name.length > 100) {
      setFormError('List name must be at most 100 characters');
      return;
    }
    const description = formDescription.trim();
    if (description.length > 500) {
      setFormError('Description must be at most 500 characters');
      return;
    }

    try {
      if (modal?.type === 'create') {
        await createMutation.mutateAsync({
          name,
          description: description || null,
        });
      } else if (modal?.type === 'rename') {
        await updateMutation.mutateAsync({
          id: modal.list.id,
          name,
          description: description || null,
        });
      }
      setModal(null);
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['lists']],
        setError: setFormError,
        fallback: 'Something went wrong. Please try again.',
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      // Keep dialog open; surface error on the dialog via mutation state
      if (!(err instanceof ApiError)) {
        // no-op; button shows retry
      }
    }
  }

  const lists = listsQuery.data ?? [];
  const saving = createMutation.isPending || updateMutation.isPending;

  const isRefetching =
    listsQuery.isFetching && !listsQuery.isLoading && listsQuery.isSuccess;

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Grocery List Manager</h1>
          <p className="muted small">
            Signed in as {user?.email}
            {isRefetching && (
              <span className="sync-inline" role="status">
                {' '}
                · Refreshing…
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <Link to="/categories" className="btn secondary">
            Categories
          </Link>
          <button type="button" className="btn secondary" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>

      <main id="main-content" className="lists-main" tabIndex={-1}>
        <div className="lists-toolbar">
          <h2 className="lists-heading">Your lists</h2>
          <button type="button" className="btn primary" onClick={openCreate}>
            New list
          </button>
        </div>

        {listsQuery.isLoading && (
          <p className="muted" role="status">
            Loading lists…
          </p>
        )}

        {listsQuery.isError && (
          <div className="card shell error-state" role="alert">
            <h3 className="error-state-title">Could not load lists</h3>
            <p className="error">
              {listsQuery.error instanceof ApiError
                ? listsQuery.error.message
                : 'Something went wrong while loading your lists.'}
            </p>
            <button
              type="button"
              className="btn secondary"
              onClick={() => void listsQuery.refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {listsQuery.isSuccess && lists.length === 0 && (
          <div className="card shell empty-state">
            <h3>No lists yet</h3>
            <p className="muted">
              Create your first grocery list to start planning a shopping trip.
              Changes sync to every device you use.
            </p>
            <button type="button" className="btn primary" onClick={openCreate}>
              Create a list
            </button>
          </div>
        )}

        {listsQuery.isSuccess && lists.length > 0 && (
          <ul className="list-cards">
            {lists.map((list) => (
              <li key={list.id} className="list-card">
                <Link to={`/lists/${list.id}`} className="list-card-main">
                  <span className="list-card-name">{list.name}</span>
                  {list.description && (
                    <span className="list-card-desc muted">{list.description}</span>
                  )}
                  <span className="list-card-meta muted small">
                    {itemCountLabel(list)}
                    <span className="meta-sep" aria-hidden>
                      ·
                    </span>
                    Updated {formatRelativeDate(list.updatedAt)}
                  </span>
                </Link>
                <div className="list-card-actions">
                  <button
                    type="button"
                    className="btn secondary btn-sm"
                    onClick={() => openRename(list)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn danger-outline btn-sm"
                    onClick={() => setDeleteTarget(list)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {modal && (
        <Modal
          title={modal.type === 'create' ? 'New list' : 'Rename list'}
          onClose={closeModal}
          busy={saving}
        >
          <form className="form" onSubmit={(e) => void onSubmitModal(e)}>
            <label htmlFor={nameFieldId}>
              Name
              <input
                id={nameFieldId}
                ref={nameInputRef}
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={100}
                required
                autoComplete="off"
              />
            </label>
            <label htmlFor={descFieldId}>
              Description <span className="optional">(optional)</span>
              <input
                id={descFieldId}
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                maxLength={500}
                autoComplete="off"
              />
            </label>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving
                  ? 'Saving…'
                  : modal.type === 'create'
                    ? 'Create list'
                    : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete list?"
          onClose={() => setDeleteTarget(null)}
          busy={deleteMutation.isPending}
        >
          <p>
            Permanently delete <strong>{deleteTarget.name}</strong> and all of
            its items? This cannot be undone.
          </p>
          {deleteMutation.isError && (
            <p className="error" role="alert">
              {deleteMutation.error instanceof ApiError
                ? deleteMutation.error.message
                : 'Could not delete list. Try again.'}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => void confirmDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete list'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
