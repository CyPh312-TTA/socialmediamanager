import api from './client';
import type { MediaAsset } from '../types';

interface MediaListResponse {
  items: MediaAsset[];
  total: number;
}

export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await api.post<MediaAsset>('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data;
}

export async function listMedia(mediaType?: string, skip = 0, limit = 50) {
  const params: Record<string, string | number> = { skip, limit };
  if (mediaType) params.media_type = mediaType;
  const resp = await api.get<MediaListResponse>('/media/', { params });
  return resp.data;
}

export async function deleteMedia(id: string) {
  await api.delete(`/media/${id}`);
}
