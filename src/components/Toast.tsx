import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

const typeStyles: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-green-600',
    icon: <CheckCircle className="w-5 h-5 text-white" />
  },
  error: {
    bg: 'bg-red-600',
    icon: <XCircle className="w-5 h-5 text-white" />
  },
  warning: {
    bg: 'bg-amber-600',
    icon: <AlertTriangle className="w-5 h-5 text-white" />
  },
  info: {
    bg: 'bg-blue-600',
    icon: <Info className="w-5 h-5 text-white" />
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = (id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  };

  const scheduleRemoval = (toast: ToastMessage) => {
    clearTimer(toast.id);
    const duration = toast.duration ?? 3500;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      timers.current.delete(toast.id);
    }, duration);
    timers.current.set(toast.id, timer);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ToastMessage>;
      const msg = custom.detail;
      setToasts((prev) => [...prev, msg]);
      scheduleRemoval(msg);
    };
    window.addEventListener('app:toast', handler as EventListener);
    return () => {
      window.removeEventListener('app:toast', handler as EventListener);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-[9999] top-4 right-4 flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => {
        const styles = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={`${styles.bg} text-white shadow-lg rounded-lg px-4 py-3 flex items-start gap-3 animate-fade-in`}
            onMouseEnter={() => clearTimer(toast.id)}
            onMouseLeave={() => scheduleRemoval(toast)}
          >
            <div className="mt-0.5">{styles.icon}</div>
            <div className="flex-1">
              {toast.title && <div className="font-semibold text-sm">{toast.title}</div>}
              <div className="text-sm whitespace-pre-line">{toast.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


