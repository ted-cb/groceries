import { apiFetch } from './client';

export type ItemMemoryCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type ItemMemory = {
  id: string;
  name: string;
  nameKey: string;
  categoryId: string;
  useCount: number;
  lastUsedAt: string;
  category: ItemMemoryCategory;
};

export type ItemMemoriesResponse = {
  itemMemories: ItemMemory[];
};

export function searchItemMemories(query: string, limit = 12) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }
  if (limit !== 12) {
    params.set('limit', String(limit));
  }
  const qs = params.toString();
  return apiFetch<ItemMemoriesResponse>(
    `/api/item-memories${qs ? `?${qs}` : ''}`
  );
}
