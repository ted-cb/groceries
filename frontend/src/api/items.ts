import { apiFetch } from './client';

export type ItemCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type GroceryItem = {
  id: string;
  listId: string;
  categoryId: string;
  name: string;
  quantity: string | null;
  note: string | null;
  isChecked: boolean;
  checkedAt: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
  category: ItemCategory;
};

export type ItemsResponse = {
  items: GroceryItem[];
};

export type ItemResponse = {
  item: GroceryItem;
};

export type CreateItemInput = {
  name: string;
  categoryId: string;
  quantity?: string | null;
  note?: string | null;
};

export type UpdateItemInput = {
  name?: string;
  categoryId?: string;
  quantity?: string | null;
  note?: string | null;
  isChecked?: boolean;
  sortOrder?: number;
};

export type ClearCheckedResponse = {
  deletedCount: number;
};

export function getListItems(listId: string) {
  return apiFetch<ItemsResponse>(`/api/lists/${listId}/items`);
}

export function createItem(listId: string, input: CreateItemInput) {
  return apiFetch<ItemResponse>(`/api/lists/${listId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateItem(itemId: string, input: UpdateItemInput) {
  return apiFetch<ItemResponse>(`/api/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteItem(itemId: string) {
  return apiFetch<void>(`/api/items/${itemId}`, {
    method: 'DELETE',
  });
}

export function clearCheckedItems(listId: string) {
  return apiFetch<ClearCheckedResponse>(
    `/api/lists/${listId}/items/clear-checked`,
    { method: 'POST' }
  );
}

/** Reorder a subset of items (typically one category / checked group). */
export function reorderItems(listId: string, orderedIds: string[]) {
  return apiFetch<ItemsResponse>(`/api/lists/${listId}/items/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}
