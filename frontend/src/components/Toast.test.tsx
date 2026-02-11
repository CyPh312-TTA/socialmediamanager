import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToastContainer, { useToastStore, toast } from './Toast';

describe('Toast store', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  it('addToast adds a toast to the store', () => {
    useToastStore.getState().addToast('Hello world', 'success');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello world');
    expect(toasts[0].type).toBe('success');
  });

  it('removeToast removes by id', () => {
    useToastStore.getState().addToast('first', 'info');
    useToastStore.getState().addToast('second', 'info');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);

    useToastStore.getState().removeToast(toasts[0].id);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('second');
  });

  it('toast.success helper works', () => {
    toast.success('It worked!');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('It worked!');
  });

  it('toast.error helper sets error type', () => {
    toast.error('Something broke');
    const { toasts } = useToastStore.getState();
    expect(toasts[0].type).toBe('error');
  });

  it('toast auto-removes after duration', () => {
    useToastStore.getState().addToast('temp', 'info', 3000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(3500);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('ToastContainer component', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useRealTimers();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toast messages', () => {
    useToastStore.getState().addToast('Test message', 'success', 0);
    render(<ToastContainer />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    useToastStore.getState().addToast('First', 'success', 0);
    useToastStore.getState().addToast('Second', 'error', 0);
    render(<ToastContainer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
