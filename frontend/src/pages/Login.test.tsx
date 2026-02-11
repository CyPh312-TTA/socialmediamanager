import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { useAuthStore } from '../store/authStore';

// Mock the API module
vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
}));

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  it('renders sign in form by default', () => {
    renderLogin();
    expect(screen.getByText('Social Media Manager')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min 6 characters')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('switches to register form', () => {
    renderLogin();
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
  });

  it('switches back to login from register', () => {
    renderLogin();
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    expect(screen.getByText('Create your account')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Already have an account? Sign in'));
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('has email and password inputs', () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('allows typing in email and password fields', () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('Min 6 characters') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('shows full name field only in register mode', () => {
    renderLogin();
    expect(screen.queryByPlaceholderText('John Doe')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
  });
});
