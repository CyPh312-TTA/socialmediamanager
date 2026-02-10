import api from './client';
import type { TokenResponse, User } from '../types';

export async function register(email: string, password: string, fullName: string) {
  const resp = await api.post<User>('/auth/register', {
    email,
    password,
    full_name: fullName,
  });
  return resp.data;
}

export async function login(email: string, password: string) {
  const resp = await api.post<TokenResponse>('/auth/login', { email, password });
  return resp.data;
}

export async function getMe() {
  const resp = await api.get<User>('/auth/me');
  return resp.data;
}
