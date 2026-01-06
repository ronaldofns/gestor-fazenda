import { useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({ message: '' });
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setOnConfirmCallback(() => () => {
        setIsOpen(false);
        resolve(true);
      });
      setIsOpen(true);
    });
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setOnConfirmCallback(null);
  }, []);

  const Dialog = (
    <ConfirmDialog
      open={isOpen}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      variant={options.variant}
      onConfirm={onConfirmCallback || handleCancel}
      onCancel={handleCancel}
    />
  );

  return { confirm, Dialog };
}

