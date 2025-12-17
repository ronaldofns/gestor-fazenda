import { v4 as uuidv4 } from 'uuid';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastParams {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export function showToast({ type = 'info', title, message, duration }: ToastParams) {
  if (typeof window === 'undefined') return;
  const id = uuidv4();
  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: { id, type, title, message, duration }
    })
  );
}

