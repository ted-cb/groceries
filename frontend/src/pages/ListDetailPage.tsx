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

  const editNameId = useId();
  const editQtyId = useId();
  const editNoteId = useId();
  const editCatId = useId();
  const quickCatId = useId();
  const quickNameId = useId();

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

  const createMutation = useMutation({
    mutationFn: (input: itemsApi.CreateItemInput) =>
      itemsApi.createItem(listId, input),
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.deleteItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lists', listId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const items = itemsQuery.data ?? [];
  const itemCount = items.length;

  /** Groups with items, in the user's category sort order. */
  const itemGroups = useMemo(() => {
    const byCategory = new Map<string, GroceryItem[]>();
    for (const item of items) {
      const list = byCategory.get(item.categoryId) ?? [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    }

    const sortItems = (groupItems: GroceryItem[]) =>
      [...groupItems].sort((a, b) => {
        // Unchecked above checked (Phase 5 will make this more visible)
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
    for (const item of items) {
      if (!seen.has(item.categoryId)) {
        orderedIds.push(item.categoryId);
        seen.add(item.categoryId);
      }
    }

    return orderedIds.map((categoryId) => {
      const groupItems = sortItems(byCategory.get(categoryId) ?? []);
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
      };
    });
  }, [items, categories]);

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
      if (err instanceof ApiError) {
        setQuickError(err.message);
      } else {
        setQuickError('Could not add item. Try again.');
      }
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
      if (err instanceof ApiError) {
        setEditError(err.message);
      } else {
        setEditError('Could not save item. Try again.');
      }
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

  const pageLoading =
    listQuery.isLoading || itemsQuery.isLoading || categoriesQuery.isLoading;
  const pageError = listQuery.isError || itemsQuery.isError || categoriesQuery.isError;

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
          <p className="muted small">Signed in as {user?.email}</p>
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
        <div className="card shell" role="alert">
          <p className="error">
            {(listQuery.error instanceof ApiError && listQuery.error.message) ||
              (itemsQuery.error instanceof ApiError && itemsQuery.error.message) ||
              (categoriesQuery.error instanceof ApiError &&
                categoriesQuery.error.message) ||
              'Could not load this list.'}
          </p>
          <p>
            <Link to="/">Back to all lists</Link>
          </p>
        </div>
      )}

      {listQuery.isSuccess && itemsQuery.isSuccess && categoriesQuery.isSuccess && (
        <>
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
              <h2 className="lists-heading">Items</h2>
              <p className="muted small">
                {itemCount === 0
                  ? 'Empty list'
                  : `${itemCount} item${itemCount === 1 ? '' : 's'}`}
              </p>
            </div>

            {itemCount === 0 ? (
              <div className="card empty-state">
                <h3>No items yet</h3>
                <p className="muted">
                  Type a name above and press Enter or tap Add to start this list.
                </p>
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
                    <ul className="item-rows">
                      {group.items.map((item) => (
                        <li key={item.id} className="item-row card">
                          <div className="item-row-body">
                            <span className="item-name">{item.name}</span>
                            {(item.quantity || item.note) && (
                              <span className="item-meta muted small">
                                {item.quantity && <span>{item.quantity}</span>}
                                {item.quantity && item.note && (
                                  <span className="meta-sep" aria-hidden>
                                    ·
                                  </span>
                                )}
                                {item.note && <span>{item.note}</span>}
                              </span>
                            )}
                          </div>
                          <div className="item-row-actions">
                            <button
                              type="button"
                              className="btn secondary btn-sm"
                              onClick={() => setEditItem(item)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn danger-outline btn-sm"
                              onClick={() => setDeleteTarget(item)}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </main>
        </>
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
    </div>
  );
}
