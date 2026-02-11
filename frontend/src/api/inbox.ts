import { api } from './client';

export interface InboxMessage {
  id: string;
  platform: string;
  message_type: string;
  sender_username: string;
  sender_avatar_url: string | null;
  content: string;
  is_read: boolean;
  is_replied: boolean;
  sentiment: string | null;
  received_at: string;
}

export interface InboxListResponse {
  items: InboxMessage[];
  total: number;
  unread: number;
}

export interface UnreadCounts {
  by_platform: Record<string, number>;
  by_type: Record<string, number>;
  total: number;
}

export const fetchInbox = (params?: {
  platform?: string;
  message_type?: string;
  is_read?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}) => api.get<InboxListResponse>('/inbox', { params }).then(r => r.data);

export const getUnreadCounts = () =>
  api.get<UnreadCounts>('/inbox/unread-counts').then(r => r.data);

export const markAsRead = (messageId: string) =>
  api.patch(`/inbox/${messageId}/read`).then(r => r.data);

export const markAllRead = (platform?: string) =>
  api.post('/inbox/mark-all-read', { platform }).then(r => r.data);

export const replyToMessage = (messageId: string, replyText: string) =>
  api.post(`/inbox/${messageId}/reply`, { reply_text: replyText }).then(r => r.data);
