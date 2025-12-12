import React from 'react';

export default function IconButton({ children, onClick, title }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 rounded-md hover:bg-slate-100 focus:outline-none"
    >
      {children}
    </button>
  );
}
