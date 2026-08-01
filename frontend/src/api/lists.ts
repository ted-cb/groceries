import { apiFetch } from './client';

export type GroceryList = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  uncheckedCount: number;
};

export type ListsResponse = {
  lists: GroceryList[];
};

export type ListResponse = {
  list: GroceryList;
};

export type CreateListInput = {
  name: string;
  description?: string | null;
};

export type UpdateListInput = {
  name?: string;
  description?: string | null;
};

export function getLists() {
  return apiFetch<ListsResponse>('/api/lists');
}

export function getList(listId: string) {
  return apiFetch<ListResponse>(`/api/lists/${listId}`);
}

export function createList(input: CreateListInput) {
  return apiFetch<ListResponse>('/api/lists', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateList(listId: string, input: UpdateListInput) {
  return apiFetch<ListResponse>(`/api/lists/${listId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteList(listId: string) {
  return apiFetch<void>(`/api/lists/${listId}`, {
    method: 'DELETE',
  });
}
