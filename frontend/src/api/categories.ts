import { apiFetch } from './client';

export type Category = {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  itemCount?: number;
};

export type CategoriesResponse = {
  categories: Category[];
};

export type CategoryResponse = {
  category: Category;
};

export type CreateCategoryInput = {
  name: string;
};

export type UpdateCategoryInput = {
  name?: string;
  sortOrder?: number;
};

export function getCategories() {
  return apiFetch<CategoriesResponse>('/api/categories');
}

export function createCategory(input: CreateCategoryInput) {
  return apiFetch<CategoryResponse>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  return apiFetch<CategoryResponse>(`/api/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function reorderCategories(orderedIds: string[]) {
  return apiFetch<CategoriesResponse>('/api/categories/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}

export function deleteCategory(
  categoryId: string,
  reassignToCategoryId: string
) {
  return apiFetch<void>(`/api/categories/${categoryId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reassignToCategoryId }),
  });
}
