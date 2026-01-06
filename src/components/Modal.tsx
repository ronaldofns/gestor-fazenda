import React from 'react';

interface ModalProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}

export default function Modal({ children, open, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
