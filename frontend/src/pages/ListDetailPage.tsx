import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import * as listsApi from '../api/lists';
import * as itemsApi from '../api/items';
import type { GroceryItem } from '../api/items';
import * as categoriesApi from '../api/categories';
import type { Category } from '../api/categories';
import { SortableItemGroup } from '../components/SortableItemGroup';
import { handleWriteError } from '../sync/handleWriteError';

const LAST_CATEGORY_KEY = 'grocery-last-category-id';

function pickDefaultCategoryId(categories: Category[]): string {
  if (categories.length === 0) return '';

  try {
    const stored = localStorage.getItem(LAST_CATEGORY_KEY);
    if (stored && categories.some((c) => c.id === stored)) {
      return stored;
    }
  } catch {
    // ignore storage errors
  }

  const other = categories.find((c) => c.name === 'Other');
  return other?.id ?? categories[0].id;
}

function rememberCategory(categoryId: string) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
  } catch {
    // ignore
  }
}

export function ListDetailPage() {
  const { listId = '' } = useParams<{ listId: string }>();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [quickName, setQuickName] = useState('');
  const [quickCategoryId, setQuickCategoryId] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const quickNameRef = useRef<HTMLInputElement>(null);

  const [editItem, setEditItem] = useState<GroceryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const editNameRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<GroceryItem | null>(null);
  const [showClearCheckedConfirm, setShowClearCheckedConfirm] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const editNameId = useId();
  const editQtyId = useId();
  const editNoteId = useId();
  const editCatId = useId();
  const quickCatId = useId();
  const quickNameId = useId();
  const hideCheckedId = useId();

  const listQuery = useQuery({
    queryKey: ['lists', listId],
    queryFn: async () => {
      const data = await listsApi.getList(listId);
      return data.list;
    },
    enabled: Boolean(listId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const data = await categoriesApi.getCategories();
      return data.categories;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ['lists', listId, 'items'],
    queryFn: async () => {
      const data = await itemsApi.getListItems(listId);
      return data.items;
    },
    enabled: Boolean(listId),
  });

  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    if (categories.length > 0 && !quickCategoryId) {
      setQuickCategoryId(pickDefaultCategoryId(categories));
    }
  }, [categories, quickCategoryId]);

  useEffect(() => {
    if (editItem) {
      setEditName(editItem.name);
      setEditQuantity(editItem.quantity ?? '');
      setEditNote(editItem.note ?? '');
      setEditCategoryId(editItem.categoryId);
      setEditError(null);
      requestAnimationFrame(() => editNameRef.current?.focus());
    }
  }, [editItem]);

  const listInvalidateKeys = useMemo(
    () => [['lists', listId, 'items'], ['lists', listId], ['lists']],
    [listId]
  );

  const createMutation = useMutation({
    mutationFn: (input: itemsApi.CreateItemInput) =>
      itemsApi.createItem(listId, input),
    meta: { syncTrack: true, syncLabel: 'item' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & itemsApi.UpdateItemInput) =>
      itemsApi.updateItem(id, input),
    meta: { syncTrack: true, syncLabel: 'item' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const checkMutation = useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      itemsApi.updateItem(id, { isChecked }),
    meta: { syncTrack: true, syncLabel: 'check' },
    onMutate: async ({ id, isChecked }) => {
      setCheckError(null);
      await queryClient.cancelQueries({ queryKey: ['lists', listId, 'items'] });
      const previous = queryClient.getQueryData<GroceryItem[]>([
        'lists',
        listId,
        'items',
      ]);
      queryClient.setQueryData<GroceryItem[]>(
        ['lists', listId, 'items'],
        (old) =>
          (old ?? []).map((item) =>
            item.id === id
              ? {
                  ...item,
                  isChecked,
                  checkedAt: isChecked ? new Date().toISOString() : null,
                }
              : item
          )
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['lists', listId, 'items'],
          context.previous
        );
      }
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
        setError: setCheckError,
        fallback: 'Could not update checked state. Try again.',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.deleteItem(id),
    meta: { syncTrack: true, syncLabel: 'item' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
    onError: (err) => {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
      });
    },
  });

  const clearCheckedMutation = useMutation({
    mutationFn: () => itemsApi.clearCheckedItems(listId),
    meta: { syncTrack: true, syncLabel: 'clear' },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      setShowClearCheckedConfirm(false);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      itemsApi.reorderItems(listId, orderedIds),
    meta: { syncTrack: true, syncLabel: 'reorder' },
    onSuccess: (data) => {
      queryClient.setQueryData(['lists', listId, 'items'], data.items);
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      setCheckError(null);
    },
    onError: (err) => {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['lists', listId, 'items']],
        setError: setCheckError,
        fallback: 'Could not save item order. Try again.',
      });
    },
  });

  const items = itemsQuery.data ?? [];
  const itemCount = items.length;
  const checkedCount = useMemo(
    () => items.filter((item) => item.isChecked).length,
    [items]
  );
  const uncheckedCount = itemCount - checkedCount;

  /** Groups with items, in the user's category sort order. */
  const itemGroups = useMemo(() => {
    const visibleItems = hideChecked
      ? items.filter((item) => !item.isChecked)
      : items;

    const byCategory = new Map<string, GroceryItem[]>();
    for (const item of visibleItems) {
      const list = byCategory.get(item.categoryId) ?? [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    }

    const sortItems = (groupItems: GroceryItem[]) =>
      [...groupItems].sort((a, b) => {
        // Unchecked above checked within each category
        if (a.isChecked !== b.isChecked) {
          return a.isChecked ? 1 : -1;
        }
        const aSort = a.sortOrder ?? 0;
        const bSort = b.sortOrder ?? 0;
        if (aSort !== bSort) return aSort - bSort;
        return a.createdAt.localeCompare(b.createdAt);
      });

    // Prefer live category order from management; fall back to embedded item data
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const c of categories) {
      if (byCategory.has(c.id)) {
        orderedIds.push(c.id);
        seen.add(c.id);
      }
    }
    for (const item of visibleItems) {
      if (!seen.has(item.categoryId)) {
        orderedIds.push(item.categoryId);
        seen.add(item.categoryId);
      }
    }

    return orderedIds.map((categoryId) => {
      const groupItems = sortItems(byCategory.get(categoryId) ?? []);
      const unchecked = groupItems.filter((i) => !i.isChecked);
      const checked = groupItems.filter((i) => i.isChecked);
      const fromCategories = categories.find((c) => c.id === categoryId);
      const name =
        fromCategories?.name ?? groupItems[0]?.category.name ?? 'Category';
      const sortOrder =
        fromCategories?.sortOrder ?? groupItems[0]?.category.sortOrder ?? 0;
      return {
        categoryId,
        name,
        sortOrder,
        items: groupItems,
        unchecked,
        checked,
      };
    });
  }, [items, categories, hideChecked]);

  function applyLocalItemOrder(orderedIds: string[]) {
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
    queryClient.setQueryData<GroceryItem[]>(
      ['lists', listId, 'items'],
      (old) =>
        (old ?? []).map((item) =>
          orderMap.has(item.id)
            ? { ...item, sortOrder: orderMap.get(item.id)! }
            : item
        )
    );
  }

  function onItemsReorder(orderedIds: string[]) {
    applyLocalItemOrder(orderedIds);
    reorderMutation.mutate(orderedIds);
  }

  async function onQuickAdd(e: FormEvent) {
    e.preventDefault();
    setQuickError(null);

    const name = quickName.trim();
    if (!name) {
      setQuickError('Item name is required');
      quickNameRef.current?.focus();
      return;
    }
    if (!quickCategoryId) {
      setQuickError('Choose a category');
      return;
    }

    try {
      await createMutation.mutateAsync({
        name,
        categoryId: quickCategoryId,
      });
      rememberCategory(quickCategoryId);
      setQuickName('');
      quickNameRef.current?.focus();
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
        setError: setQuickError,
        fallback: 'Could not add item. Try again.',
      });
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditError(null);

    const name = editName.trim();
    if (!name) {
      setEditError('Item name is required');
      return;
    }
    if (!editCategoryId) {
      setEditError('Choose a category');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        name,
        categoryId: editCategoryId,
        quantity: editQuantity.trim() || null,
        note: editNote.trim() || null,
      });
      rememberCategory(editCategoryId);
      setEditItem(null);
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
        setError: setEditError,
        fallback: 'Could not save item. Try again.',
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // error shown via mutation state
    }
  }

  function toggleChecked(item: GroceryItem) {
    checkMutation.mutate({ id: item.id, isChecked: !item.isChecked });
  }

  async function confirmClearChecked() {
    try {
      await clearCheckedMutation.mutateAsync();
    } catch {
      // error shown via mutation state
    }
  }

  const pageLoading =
    listQuery.isLoading || itemsQuery.isLoading || categoriesQuery.isLoading;
  const pageError = listQuery.isError || itemsQuery.isError || categoriesQuery.isError;

  const itemsSummary =
    itemCount === 0
      ? 'Empty list'
      : checkedCount === 0
        ? `${itemCount} item${itemCount === 1 ? '' : 's'}`
        : `${uncheckedCount} left · ${checkedCount} checked · ${itemCount} total`;

  const isRefetching =
    (listQuery.isFetching || itemsQuery.isFetching || categoriesQuery.isFetching) &&
    !pageLoading &&
    listQuery.isSuccess &&
    itemsQuery.isSuccess;

  return (
    <div className="page list-detail-page">
      <header className="app-header">
        <div>
          <p className="breadcrumb">
            <Link to="/">← All lists</Link>
          </p>
          <h1 className="app-title">
            {listQuery.isLoading
              ? 'Loading…'
              : listQuery.data?.name ?? 'List'}
          </h1>
          {listQuery.data?.description && (
            <p className="muted small">{listQuery.data.description}</p>
          )}
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

      {pageLoading && (
        <p className="muted shell" role="status">
          Loading list…
        </p>
      )}

      {pageError && !pageLoading && (
        <div className="card shell error-state" role="alert">
          <h3 className="error-state-title">Could not load this list</h3>
          <p className="error">
            {(listQuery.error instanceof ApiError && listQuery.error.message) ||
              (itemsQuery.error instanceof ApiError && itemsQuery.error.message) ||
              (categoriesQuery.error instanceof ApiError &&
                categoriesQuery.error.message) ||
              'Something went wrong while loading this list.'}
          </p>
          <div className="error-state-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                void listQuery.refetch();
                void itemsQuery.refetch();
                void categoriesQuery.refetch();
              }}
            >
              Retry
            </button>
            <Link to="/" className="btn secondary">
              Back to all lists
            </Link>
          </div>
        </div>
      )}

      {listQuery.isSuccess && itemsQuery.isSuccess && categoriesQuery.isSuccess && (
        <div id="main-content" tabIndex={-1}>
          <form className="quick-add card shell" onSubmit={(e) => void onQuickAdd(e)}>
            <label className="quick-add-name" htmlFor={quickNameId}>
              <span className="sr-only">Item name</span>
              <input
                id={quickNameId}
                ref={quickNameRef}
                type="text"
                placeholder="Add an item…"
                value={quickName}
                onChange={(e) => {
                  setQuickName(e.target.value);
                  if (quickError) setQuickError(null);
                }}
                maxLength={200}
                autoComplete="off"
                disabled={createMutation.isPending}
              />
            </label>
            <label className="quick-add-category" htmlFor={quickCatId}>
              <span className="sr-only">Category</span>
              <select
                id={quickCatId}
                value={quickCategoryId}
                onChange={(e) => setQuickCategoryId(e.target.value)}
                disabled={createMutation.isPending || categories.length === 0}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="btn primary"
              disabled={createMutation.isPending || categories.length === 0}
            >
              {createMutation.isPending ? 'Adding…' : 'Add'}
            </button>
            {quickError && (
              <p className="error quick-add-error" role="alert">
                {quickError}
              </p>
            )}
          </form>

          <main className="items-main">
            <div className="items-toolbar">
              <div>
                <h2 className="lists-heading">Items</h2>
                <p className="muted small">{itemsSummary}</p>
              </div>
              {itemCount > 0 && (
                <div className="shopping-actions">
                  {checkedCount > 0 && (
                    <label className="hide-checked-toggle" htmlFor={hideCheckedId}>
                      <input
                        id={hideCheckedId}
                        type="checkbox"
                        checked={hideChecked}
                        onChange={(e) => setHideChecked(e.target.checked)}
                      />
                      <span>Hide checked</span>
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn secondary btn-sm"
                    disabled={checkedCount === 0}
                    onClick={() => setShowClearCheckedConfirm(true)}
                  >
                    Clear checked
                  </button>
                </div>
              )}
            </div>

            {checkError && (
              <div className="sync-error-banner shell" role="alert">
                <p className="error">{checkError}</p>
                <button
                  type="button"
                  className="btn secondary btn-sm"
                  onClick={() => {
                    setCheckError(null);
                    void itemsQuery.refetch();
                  }}
                >
                  Refresh list
                </button>
              </div>
            )}

            {itemCount === 0 ? (
              <div className="card empty-state">
                <h3>No items yet</h3>
                <p className="muted">
                  Type a name above and press Enter or tap Add to start this list.
                </p>
              </div>
            ) : itemGroups.length === 0 ? (
              <div className="card empty-state">
                <h3>All items checked</h3>
                <p className="muted">
                  Checked items are hidden. Turn off “Hide checked” to see them,
                  or clear them when you are done shopping.
                </p>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setHideChecked(false)}
                >
                  Show checked items
                </button>
              </div>
            ) : (
              <div className="category-groups">
                {itemGroups.map((group) => (
                  <section
                    key={group.categoryId}
                    className="category-group"
                    aria-labelledby={`cat-${group.categoryId}`}
                  >
                    <h3
                      id={`cat-${group.categoryId}`}
                      className="category-group-title"
                    >
                      {group.name}
                      <span className="category-group-count muted">
                        {group.items.length}
                      </span>
                    </h3>
                    <div className="category-item-stacks">
                      <SortableItemGroup
                        items={group.unchecked}
                        onReorder={onItemsReorder}
                        onToggleChecked={toggleChecked}
                        onEdit={setEditItem}
                        onDelete={setDeleteTarget}
                      />
                      {!hideChecked && (
                        <SortableItemGroup
                          items={group.checked}
                          onReorder={onItemsReorder}
                          onToggleChecked={toggleChecked}
                          onEdit={setEditItem}
                          onDelete={setDeleteTarget}
                        />
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {editItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updateMutation.isPending) {
              setEditItem(null);
            }
          }}
        >
          <div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-item-title"
          >
            <h2 id="edit-item-title">Edit item</h2>
            <form className="form" onSubmit={(e) => void onSaveEdit(e)}>
              <label htmlFor={editNameId}>
                Name
                <input
                  id={editNameId}
                  ref={editNameRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={200}
                  required
                  autoComplete="off"
                />
              </label>
              <label htmlFor={editQtyId}>
                Quantity <span className="optional">(optional)</span>
                <input
                  id={editQtyId}
                  type="text"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. 2 lb"
                  autoComplete="off"
                />
              </label>
              <label htmlFor={editNoteId}>
                Note <span className="optional">(optional)</span>
                <input
                  id={editNoteId}
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. organic"
                  autoComplete="off"
                />
              </label>
              <label htmlFor={editCatId}>
                Category
                <select
                  id={editCatId}
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {editError && (
                <p className="error" role="alert">
                  {editError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setEditItem(null)}
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
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteMutation.isPending) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-title"
          >
            <h2 id="delete-item-title">Delete item?</h2>
            <p>
              Remove <strong>{deleteTarget.name}</strong> from this list?
            </p>
            {deleteMutation.isError && (
              <p className="error" role="alert">
                {deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : 'Could not delete item. Try again.'}
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
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearCheckedConfirm && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              !clearCheckedMutation.isPending
            ) {
              setShowClearCheckedConfirm(false);
            }
          }}
        >
          <div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-checked-title"
          >
            <h2 id="clear-checked-title">Clear checked items?</h2>
            <p>
              Remove{' '}
              <strong>
                {checkedCount} checked item{checkedCount === 1 ? '' : 's'}
              </strong>{' '}
              from this list? This cannot be undone.
            </p>
            {clearCheckedMutation.isError && (
              <p className="error" role="alert">
                {clearCheckedMutation.error instanceof ApiError
                  ? clearCheckedMutation.error.message
                  : 'Could not clear checked items. Try again.'}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowClearCheckedConfirm(false)}
                disabled={clearCheckedMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void confirmClearChecked()}
                disabled={clearCheckedMutation.isPending || checkedCount === 0}
              >
                {clearCheckedMutation.isPending
                  ? 'Clearing…'
                  : 'Clear checked'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
