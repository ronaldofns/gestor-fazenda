import React from 'react';

export default function Modal({ children, open, onClose }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-30" onClick={onClose} />
      <div className="bg-white p-4 rounded shadow-lg z-10 max-w-md w-full">{children}</div>
    </div>
  );
}
