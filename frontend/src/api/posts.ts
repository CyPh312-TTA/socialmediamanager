import api from './client';
import type { Post } from '../types';

interface PostListResponse {
  items: Post[];
  total: number;
}

interface CreatePostData {
  caption: string;
  hashtags?: string[];
  post_type?: string;
  media_ids?: string[];
  account_ids: string[];
  platform_captions?: Record<string, string>;
  schedule_time?: string;
  publish_now?: boolean;
}

export async function createPost(data: CreatePostData) {
  const resp = await api.post<Post>('/posts/', data);
  return resp.data;
}

export async function listPosts(status?: string, skip = 0, limit = 50) {
  const params: Record<string, string | number> = { skip, limit };
  if (status) params.status = status;
  const resp = await api.get<PostListResponse>('/posts/', { params });
  return resp.data;
}

export async function getPost(id: string) {
  const resp = await api.get<Post>(`/posts/${id}`);
  return resp.data;
}

export async function deletePost(id: string) {
  await api.delete(`/posts/${id}`);
}
