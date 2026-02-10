import api from './client';
import type { SocialAccount } from '../types';

export async function listAccounts() {
  const resp = await api.get<SocialAccount[]>('/accounts/');
  return resp.data;
}

export async function startOAuth(platform: string) {
  const resp = await api.get<{ authorization_url: string }>(`/accounts/${platform}/connect`);
  return resp.data.authorization_url;
}

export async function disconnectAccount(id: string) {
  await api.delete(`/accounts/${id}`);
}
