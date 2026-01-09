import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses } from '../utils/themeHelpers';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const variantStyles = {
    danger: {
      button: 'bg-red-600 hover:bg-red-700 text-white',
      icon: 'text-red-600',
      border: 'border-red-200 dark:border-red-500/40'
    },
    warning: {
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
      icon: 'text-amber-600',
      border: 'border-amber-200 dark:border-amber-500/40'
    },
    info: {
      button: `${getPrimaryButtonClass(primaryColor)} text-white`,
      icon: getThemeClasses(primaryColor, 'text'),
      border: `${getThemeClasses(primaryColor, 'border-light')}`
    }
  };

  const styles = variantStyles[variant];

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;
  
  const dialogContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" 
        onClick={onCancel} 
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full">
        <div className={`border-b ${styles.border} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Icons.AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {title || 'Confirmar ação'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-line">
            {message}
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}

