import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import * as listsApi from '../api/lists';
import * as itemsApi from '../api/items';
import type { GroceryItem } from '../api/items';
import * as categoriesApi from '../api/categories';
import * as itemMemoriesApi from '../api/itemMemories';
import type { ItemMemory } from '../api/itemMemories';
import { IconButton } from '../components/IconButton';
import { IconPlus } from '../components/icons';
import { ItemNameCombobox } from '../components/ItemNameCombobox';
import { Modal } from '../components/Modal';
import { SortableItemGroup } from '../components/SortableItemGroup';
import {
  findExactMemory,
  normalizeItemNameKey,
  pickPromptDefaultCategoryId,
} from '../lib/itemName';
import { handleWriteError } from '../sync/handleWriteError';

export function ListDetailPage() {
  const { listId = '' } = useParams<{ listId: string }>();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [quickName, setQuickName] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [resolvingCategory, setResolvingCategory] = useState(false);
  const quickNameRef = useRef<HTMLInputElement>(null);
  /** Suggestion pick still “sticks” until the typed name diverges. */
  const pickedMemoryRef = useRef<ItemMemory | null>(null);

  const [categoryPrompt, setCategoryPrompt] = useState<{
    name: string;
  } | null>(null);
  const [promptCategoryId, setPromptCategoryId] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const promptCatId = useId();

  const [editItem, setEditItem] = useState<GroceryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const editNameRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<GroceryItem | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const editNameId = useId();
  const editQtyId = useId();
  const editNoteId = useId();
  const editCatId = useId();
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
    if (editItem) {
      setEditName(editItem.name);
      setEditQuantity(editItem.quantity ?? '');
      setEditNote(editItem.note ?? '');
      setEditCategoryId(editItem.categoryId);
      setEditError(null);
      requestAnimationFrame(() => editNameRef.current?.focus());
    }
  }, [editItem]);

  useEffect(() => {
    if (categoryPrompt) {
      setPromptCategoryId(pickPromptDefaultCategoryId(categories));
      setPromptError(null);
    }
  }, [categoryPrompt, categories]);

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
      void queryClient.invalidateQueries({ queryKey: ['item-memories'] });
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
      void queryClient.invalidateQueries({ queryKey: ['item-memories'] });
    },
  });

  /**
   * Phase D: check-off removes the list row (item memory is kept server-side).
   */
  const completeMutation = useMutation({
    mutationFn: (id: string) => itemsApi.deleteItem(id),
    meta: { syncTrack: true, syncLabel: 'complete' },
    onMutate: async (id) => {
      setCompleteError(null);
      await queryClient.cancelQueries({ queryKey: ['lists', listId, 'items'] });
      const previous = queryClient.getQueryData<GroceryItem[]>([
        'lists',
        listId,
        'items',
      ]);
      queryClient.setQueryData<GroceryItem[]>(
        ['lists', listId, 'items'],
        (old) => (old ?? []).filter((item) => item.id !== id)
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['lists', listId, 'items'],
          context.previous
        );
      }
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
        setError: setCompleteError,
        fallback: 'Could not check off item. Try again.',
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

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      itemsApi.reorderItems(listId, orderedIds),
    meta: { syncTrack: true, syncLabel: 'reorder' },
    onSuccess: (data) => {
      queryClient.setQueryData(['lists', listId, 'items'], data.items);
      void queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      setCompleteError(null);
    },
    onError: (err) => {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: [['lists', listId, 'items']],
        setError: setCompleteError,
        fallback: 'Could not save item order. Try again.',
      });
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
        const aSort = a.sortOrder ?? 0;
        const bSort = b.sortOrder ?? 0;
        if (aSort !== bSort) return aSort - bSort;
        return a.createdAt.localeCompare(b.createdAt);
      });

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

  async function createListItem(name: string, categoryId: string) {
    await createMutation.mutateAsync({ name, categoryId });
    pickedMemoryRef.current = null;
    setQuickName('');
    setCategoryPrompt(null);
    setPromptError(null);
    setQuickError(null);
    quickNameRef.current?.focus();
  }

  function openCategoryPrompt(name: string) {
    setCategoryPrompt({ name });
    setPromptCategoryId(pickPromptDefaultCategoryId(categories));
    setPromptError(null);
  }

  /**
   * Resolve category for a typed name: sticky suggestion pick → exact memory → prompt.
   */
  async function resolveAndAdd(nameInput: string) {
    setQuickError(null);
    const name = nameInput.trim();
    if (!name) {
      setQuickError('Item name is required');
      quickNameRef.current?.focus();
      return;
    }
    if (categories.length === 0) {
      setQuickError('No categories available. Create one first.');
      return;
    }

    const nameKey = normalizeItemNameKey(name);
    const picked = pickedMemoryRef.current;
    if (picked && picked.nameKey === nameKey) {
      if (categories.some((c) => c.id === picked.categoryId)) {
        try {
          await createListItem(picked.name || name, picked.categoryId);
        } catch (err) {
          handleWriteError(err, {
            queryClient,
            invalidateKeys: listInvalidateKeys,
            setError: setQuickError,
            fallback: 'Could not add item. Try again.',
          });
        }
        return;
      }
    }

    setResolvingCategory(true);
    try {
      const data = await itemMemoriesApi.searchItemMemories(name, 20);
      const exact = findExactMemory(data.itemMemories, name);
      if (exact && categories.some((c) => c.id === exact.categoryId)) {
        await createListItem(exact.name || name, exact.categoryId);
        return;
      }
      openCategoryPrompt(name);
    } catch {
      // Offline / search failed: still allow first-time category prompt.
      openCategoryPrompt(name);
    } finally {
      setResolvingCategory(false);
    }
  }

  /** Suggestion selected: known item — apply and add immediately. */
  async function onPickMemory(memory: ItemMemory) {
    pickedMemoryRef.current = memory;
    setQuickName(memory.name);
    setQuickError(null);
    if (!categories.some((c) => c.id === memory.categoryId)) {
      openCategoryPrompt(memory.name);
      return;
    }
    try {
      await createListItem(memory.name, memory.categoryId);
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
        setError: setQuickError,
        fallback: 'Could not add item. Try again.',
      });
    }
  }

  async function onQuickAdd(e: FormEvent) {
    e.preventDefault();
    await resolveAndAdd(quickName);
  }

  async function onConfirmCategoryPrompt(e: FormEvent) {
    e.preventDefault();
    if (!categoryPrompt) return;
    setPromptError(null);
    if (!promptCategoryId) {
      setPromptError('Choose a category');
      return;
    }
    try {
      await createListItem(categoryPrompt.name, promptCategoryId);
    } catch (err) {
      handleWriteError(err, {
        queryClient,
        invalidateKeys: listInvalidateKeys,
        setError: setPromptError,
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

  function completeItem(item: GroceryItem) {
    completeMutation.mutate(item.id);
  }

  const pageLoading =
    listQuery.isLoading || itemsQuery.isLoading || categoriesQuery.isLoading;
  const pageError = listQuery.isError || itemsQuery.isError || categoriesQuery.isError;

  const itemsSummary =
    itemCount === 0
      ? 'Empty list'
      : `${itemCount} item${itemCount === 1 ? '' : 's'} remaining`;

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
          <form
            className="quick-add quick-add-smart card shell"
            onSubmit={(e) => void onQuickAdd(e)}
          >
            <label className="quick-add-name" htmlFor={quickNameId}>
              <span className="sr-only">Item name</span>
              <ItemNameCombobox
                id={quickNameId}
                inputRef={quickNameRef}
                value={quickName}
                onChange={(next) => {
                  setQuickName(next);
                  const picked = pickedMemoryRef.current;
                  if (
                    picked &&
                    normalizeItemNameKey(next) !== picked.nameKey
                  ) {
                    pickedMemoryRef.current = null;
                  }
                  if (quickError) setQuickError(null);
                }}
                onPick={(memory) => {
                  void onPickMemory(memory);
                }}
                disabled={
                  createMutation.isPending ||
                  resolvingCategory ||
                  Boolean(categoryPrompt)
                }
              />
            </label>
            <IconButton
              type="submit"
              label={
                createMutation.isPending || resolvingCategory
                  ? 'Adding item'
                  : 'Add item'
              }
              variant="primary"
              disabled={
                createMutation.isPending ||
                resolvingCategory ||
                categories.length === 0 ||
                Boolean(categoryPrompt)
              }
            >
              <IconPlus />
            </IconButton>
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
            </div>

            {completeError && (
              <div className="sync-error-banner shell" role="alert">
                <p className="error">{completeError}</p>
                <button
                  type="button"
                  className="btn secondary btn-sm"
                  onClick={() => {
                    setCompleteError(null);
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
                  Type a name above and press Enter or tap Add. Check items off as
                  you shop — they leave the list. Remembered names keep their aisle.
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
                    <SortableItemGroup
                      items={group.items}
                      onReorder={onItemsReorder}
                      onComplete={completeItem}
                      onEdit={setEditItem}
                      onDelete={setDeleteTarget}
                    />
                  </section>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {categoryPrompt && (
        <Modal
          title="Choose a category"
          onClose={() => {
            if (!createMutation.isPending) {
              setCategoryPrompt(null);
              setPromptError(null);
              quickNameRef.current?.focus();
            }
          }}
          busy={createMutation.isPending}
        >
          <p className="modal-lead">
            First time adding <strong>{categoryPrompt.name}</strong>. Pick an
            aisle — we&apos;ll remember it next time.
          </p>
          <form className="form" onSubmit={(e) => void onConfirmCategoryPrompt(e)}>
            <label htmlFor={promptCatId}>
              Category
              <select
                id={promptCatId}
                value={promptCategoryId}
                onChange={(e) => setPromptCategoryId(e.target.value)}
                disabled={createMutation.isPending || categories.length === 0}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {promptError && (
              <p className="error" role="alert">
                {promptError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setCategoryPrompt(null);
                  setPromptError(null);
                  quickNameRef.current?.focus();
                }}
                disabled={createMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={createMutation.isPending || !promptCategoryId}
              >
                {createMutation.isPending ? 'Adding…' : 'Add item'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editItem && (
        <Modal
          title="Edit item"
          onClose={() => setEditItem(null)}
          busy={updateMutation.isPending}
        >
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
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete item?"
          onClose={() => setDeleteTarget(null)}
          busy={deleteMutation.isPending}
        >
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
        </Modal>
      )}

    </div>
  );
}
