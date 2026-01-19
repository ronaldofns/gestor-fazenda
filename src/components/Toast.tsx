import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryBgClass } from '../utils/themeHelpers';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export function ToastContainer() {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const typeStyles: Record<ToastType, { bg: string; text: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-green-600 dark:bg-green-700',
      text: 'text-white',
      icon: <Icons.CheckCircle className="w-5 h-5 text-white" />
    },
    error: {
      bg: 'bg-red-600 dark:bg-red-700',
      text: 'text-white',
      icon: <Icons.XCircle className="w-5 h-5 text-white" />
    },
    warning: {
      bg: 'bg-amber-600 dark:bg-amber-700',
      text: 'text-white',
      icon: <Icons.AlertTriangle className="w-5 h-5 text-white" />
    },
    info: {
      bg: 'bg-blue-600 dark:bg-blue-700',
      text: 'text-white',
      icon: <Icons.Info className="w-5 h-5 text-white" />
    }
  };
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = (id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  };

  const removeToast = (id: string) => {
    clearTimer(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const scheduleRemoval = (toast: ToastMessage) => {
    clearTimer(toast.id);
    const duration = toast.duration ?? 2500; // Reduzido de 3500ms para 2500ms
    const timer = setTimeout(() => {
      removeToast(toast.id);
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
            className={`${styles.bg} ${styles.text} shadow-lg rounded-lg px-4 py-3 flex items-start gap-3 animate-fade-in relative`}
            onMouseEnter={() => clearTimer(toast.id)}
            onMouseLeave={() => scheduleRemoval(toast)}
          >
            <div className="mt-0.5 flex-shrink-0">{styles.icon}</div>
            <div className="flex-1 min-w-0">
              {toast.title && <div className="font-semibold text-sm text-white">{toast.title}</div>}
              <div className="text-sm whitespace-pre-line text-white">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 ml-2 p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Fechar"
            >
              <Icons.X className="w-4 h-4 text-white" />
            </button>
          </div>
        );
      })}
    </div>
  );
}


