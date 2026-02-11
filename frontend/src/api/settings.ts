import { api } from './client';
import type { User } from '../types';

export interface UserPreferences {
  default_tone: string;
  default_hashtag_count: number;
  default_platforms: string[];
  auto_hashtags: boolean;
  posting_timezone: string;
}

export async function updateProfile(data: { full_name?: string; email?: string }) {
  const resp = await api.put<User>('/settings/profile', data);
  return resp.data;
}

export async function changePassword(data: {
  current_password: string;
  new_password: string;
}) {
  const resp = await api.post<{ message: string }>('/settings/change-password', data);
  return resp.data;
}

export async function getPreferences() {
  const resp = await api.get<UserPreferences>('/settings/preferences');
  return resp.data;
}

export async function updatePreferences(data: Partial<UserPreferences>) {
  const resp = await api.put<UserPreferences>('/settings/preferences', data);
  return resp.data;
}
