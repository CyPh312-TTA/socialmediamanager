import { api } from './client';

export interface ContentCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  is_recyclable: boolean;
  recycle_interval_days: number;
  post_count: number;
}

export const listCategories = () =>
  api.get<{ items: ContentCategory[] }>('/content/categories').then(r => r.data);

export const createCategory = (data: { name: string; color?: string; icon?: string; description?: string; is_recyclable?: boolean; recycle_interval_days?: number }) =>
  api.post<ContentCategory>('/content/categories', data).then(r => r.data);

export const updateCategory = (id: string, data: Partial<ContentCategory>) =>
  api.put<ContentCategory>(`/content/categories/${id}`, data).then(r => r.data);

export const deleteCategory = (id: string) =>
  api.delete(`/content/categories/${id}`);

export const assignPostToCategory = (categoryId: string, postId: string) =>
  api.post(`/content/categories/${categoryId}/posts/${postId}`);

export const removePostFromCategory = (categoryId: string, postId: string) =>
  api.delete(`/content/categories/${categoryId}/posts/${postId}`);

export const getRecyclablePosts = () =>
  api.get('/content/categories/recyclable').then(r => r.data);

export const getRecycleQueue = () =>
  api.get('/content/categories/recycle-queue').then(r => r.data);

export const addToRecycleQueue = (data: { post_id: string; category_id: string; scheduled_for: string }) =>
  api.post('/content/categories/recycle-queue', data).then(r => r.data);
