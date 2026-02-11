import { api } from './client';

export interface FeedGridItem {
  post_id: string;
  thumbnail_url: string | null;
  caption_preview: string;
  status: string;
  scheduled_time: string | null;
  grid_position: number;
  row: number;
  col: number;
}

export interface FeedGridResponse {
  account_id: string;
  platform: string;
  items: FeedGridItem[];
  total_published: number;
  total_scheduled: number;
}

export const getFeedPreview = (accountId: string, limit?: number) =>
  api.get<FeedGridResponse>(`/feed-planner/${accountId}`, { params: { limit } }).then(r => r.data);

export const reorderFeedPosts = (accountId: string, postIds: string[]) =>
  api.put(`/feed-planner/${accountId}/reorder`, { post_ids: postIds }).then(r => r.data);
