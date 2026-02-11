import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store state between tests
    useAuthStore.setState({ user: null, isAuthenticated: false });
    localStorage.clear();
  });

  it('starts unauthenticated when no token in localStorage', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('login() stores tokens and sets isAuthenticated', () => {
    useAuthStore.getState().login('test-access-token', 'test-refresh-token');

    expect(localStorage.getItem('access_token')).toBe('test-access-token');
    expect(localStorage.getItem('refresh_token')).toBe('test-refresh-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setUser() sets user data and marks as authenticated', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      full_name: 'Test User',
      plan: 'free',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    };

    useAuthStore.getState().setUser(user);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout() clears tokens and resets state', () => {
    // First login
    useAuthStore.getState().login('token', 'refresh');
    useAuthStore.getState().setUser({
      id: '123',
      email: 'test@example.com',
      full_name: 'Test',
      plan: 'free',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    });

    // Then logout
    useAuthStore.getState().logout();

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
