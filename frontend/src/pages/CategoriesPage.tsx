import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import * as categoriesApi from '../api/categories';
import type { Category } from '../api/categories';
import { DragHandle } from '../components/DragHandle';
import { Modal } from '../components/Modal';
import { arrayMove } from '../dnd/arrayMove';
import { useListSensors } from '../dnd/sensors';
import { handleWriteError } from '../sync/handleWriteError';

function SortableCategoryRow({
  category,
  canDelete,
  onRename,
  onDelete,
}: {
  category: Category;
  canDelete: boolean;
  onRename: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'category-row card category-row-dragging'
          : 'category-row card'
      }
    >
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        label={`Drag to reorder ${category.name}`}
      />
      <div className="category-row-body">
        <span className="category-name">
          {category.name}
          {category.isDefault && (
            <span className="default-pill">Default</span>
          )}
        </span>
        <span className="muted small">
          {category.itemCount ?? 0} item
          {(category.itemCount ?? 0) === 1 ? '' : 's'} across lists
        </span>
      </div>
      <div className="category-row-actions">
        <button
          type="button"
          className="btn secondary btn-sm"
          onClick={() => onRename(category)}
        >
          Rename
        </button>
        <button
          type="button"
          className="btn danger-outline btn-sm"
          disabled={!canDelete}
          title={
            canDelete
              ? 'Delete category'
              : 'Cannot delete the last category'
          }
          onClick={() => onDelete(category)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export function CategoriesPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const sensors = useListSensors();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const createNameId = useId();

  const [renameTarget, setRenameTarget] = useState<Category | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameNameRef = useRef<HTMLInputElement>(null);
  const renameNameId = useId();

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignToId, setReassignToId] = useState('');
  const reassignId = useId();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const data = await categoriesApi.getCategories();
      return data.categories;
    },
  });

  const categories = categoriesQuery.data ?? [];
  const activeCategory = activeId
    ? categories.find((c) => c.id === activeId) ?? null
    : null;

  const createMutation = useMutation({
    mutationFn: categoriesApi.createCategory,
    meta: { syncTrack: true, syncLabel: 'category' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      categoriesApi.updateCategory(id, { name }),
    meta: { syncTrack: true, syncLabel: 'category' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      categoriesApi.reorderCategories(orderedIds),
    meta: { syncTrack: true, syncLabel: 'reorder' },
    onSuccess: (data) => {
      queryClient.setQueryData(['categories'], data.categories);
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      setReorderError(null);
    },
    onError: (err) => {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['categories']],
        setError: setReorderError,
        fallback: 'Could not save category order. Try again.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      id,
      reassignToCategoryId,
    }: {
      id: string;
      reassignToCategoryId: string;
    }) => categoriesApi.deleteCategory(id, reassignToCategoryId),
    meta: { syncTrack: true, syncLabel: 'category' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
    onError: (err) => {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['categories'], ['lists']],
      });
    },
  });

  useEffect(() => {
    if (createOpen) {
      setCreateName('');
      setCreateError(null);
      requestAnimationFrame(() => createNameRef.current?.focus());
    }
  }, [createOpen]);

  useEffect(() => {
    if (renameTarget) {
      setRenameName(renameTarget.name);
      setRenameError(null);
      requestAnimationFrame(() => renameNameRef.current?.focus());
    }
  }, [renameTarget]);

  useEffect(() => {
    if (deleteTarget) {
      const fallback =
        categories.find((c) => c.id !== deleteTarget.id && c.name === 'Other') ??
        categories.find((c) => c.id !== deleteTarget.id);
      setReassignToId(fallback?.id ?? '');
      deleteMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when target changes
  }, [deleteTarget]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const name = createName.trim();
    if (!name) {
      setCreateError('Category name is required');
      return;
    }
    try {
      await createMutation.mutateAsync({ name });
      setCreateOpen(false);
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['categories']],
        setError: setCreateError,
        fallback: 'Could not create category.',
      });
    }
  }

  async function onRename(e: FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    setRenameError(null);
    const name = renameName.trim();
    if (!name) {
      setRenameError('Category name is required');
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: renameTarget.id, name });
      setRenameTarget(null);
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['categories']],
        setError: setRenameError,
        fallback: 'Could not rename category.',
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setReorderError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(categories, oldIndex, newIndex).map(
      (c, i) => ({ ...c, sortOrder: i })
    );
    const orderedIds = reordered.map((c) => c.id);
    queryClient.setQueryData(['categories'], reordered);
    reorderMutation.mutate(orderedIds);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || !reassignToId) return;
    try {
      await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        reassignToCategoryId: reassignToId,
      });
      setDeleteTarget(null);
    } catch {
      // mutation error shown in dialog
    }
  }

  const canDelete = categories.length > 1;
  const reassignOptions = deleteTarget
    ? categories.filter((c) => c.id !== deleteTarget.id)
    : [];

  const isRefetching =
    categoriesQuery.isFetching &&
    !categoriesQuery.isLoading &&
    categoriesQuery.isSuccess;

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <p className="breadcrumb">
            <Link to="/">← All lists</Link>
          </p>
          <h1 className="app-title">Categories</h1>
          <p className="muted small">
            Organize aisles for shopping · signed in as {user?.email}
            {isRefetching && (
              <span className="sync-inline" role="status">
                {' '}
                · Refreshing…
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn secondary" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>

      <main id="main-content" className="lists-main" tabIndex={-1}>
        <div className="lists-toolbar">
          <h2 className="lists-heading">Your categories</h2>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreateOpen(true)}
          >
            New category
          </button>
        </div>

        {categoriesQuery.isLoading && (
          <p className="muted" role="status">
            Loading categories…
          </p>
        )}

        {categoriesQuery.isError && (
          <div className="card shell error-state" role="alert">
            <h3 className="error-state-title">Could not load categories</h3>
            <p className="error">
              {categoriesQuery.error instanceof ApiError
                ? categoriesQuery.error.message
                : 'Something went wrong while loading categories.'}
            </p>
            <button
              type="button"
              className="btn secondary"
              onClick={() => void categoriesQuery.refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {reorderError && (
          <div className="sync-error-banner shell" role="alert">
            <p className="error">{reorderError}</p>
            <button
              type="button"
              className="btn secondary btn-sm"
              onClick={() => {
                setReorderError(null);
                void categoriesQuery.refetch();
              }}
            >
              Refresh
            </button>
          </div>
        )}

        {categoriesQuery.isSuccess && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="category-rows">
                {categories.map((category) => (
                  <SortableCategoryRow
                    key={category.id}
                    category={category}
                    canDelete={canDelete}
                    onRename={setRenameTarget}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {activeCategory ? (
                <div className="category-row card drag-overlay-card">
                  <span className="drag-handle drag-handle-static" aria-hidden>
                    <span className="drag-handle-icon">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                  <div className="category-row-body">
                    <span className="category-name">{activeCategory.name}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        <p className="muted small shell">
          Drag the handle (⠿) to match your store layout. Order controls how
          categories appear when grouping items on a list. Keyboard: focus a
          handle, then use arrow keys.
        </p>
      </main>

      {createOpen && (
        <Modal
          title="New category"
          onClose={() => setCreateOpen(false)}
          busy={createMutation.isPending}
        >
          <form className="form" onSubmit={(e) => void onCreate(e)}>
            <label htmlFor={createNameId}>
              Name
              <input
                id={createNameId}
                ref={createNameRef}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={50}
                required
                autoComplete="off"
                placeholder="e.g. Bulk / Costco"
              />
            </label>
            {createError && (
              <p className="error" role="alert">
                {createError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {renameTarget && (
        <Modal
          title="Rename category"
          onClose={() => setRenameTarget(null)}
          busy={updateMutation.isPending}
        >
          <form className="form" onSubmit={(e) => void onRename(e)}>
            <label htmlFor={renameNameId}>
              Name
              <input
                id={renameNameId}
                ref={renameNameRef}
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                maxLength={50}
                required
                autoComplete="off"
              />
            </label>
            {renameError && (
              <p className="error" role="alert">
                {renameError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setRenameTarget(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete category?"
          onClose={() => setDeleteTarget(null)}
          busy={deleteMutation.isPending}
        >
          <p>
            Delete <strong>{deleteTarget.name}</strong>
            {(deleteTarget.itemCount ?? 0) > 0
              ? ` and reassign its ${deleteTarget.itemCount} item${
                  deleteTarget.itemCount === 1 ? '' : 's'
                } to another category`
              : ''}
            ? This cannot be undone.
          </p>
          <label htmlFor={reassignId}>
            Move items to
            <select
              id={reassignId}
              value={reassignToId}
              onChange={(e) => setReassignToId(e.target.value)}
            >
              {reassignOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {deleteMutation.isError && (
            <p className="error" role="alert">
              {deleteMutation.error instanceof ApiError
                ? deleteMutation.error.message
                : 'Could not delete category.'}
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
              disabled={deleteMutation.isPending || !reassignToId}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete category'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
