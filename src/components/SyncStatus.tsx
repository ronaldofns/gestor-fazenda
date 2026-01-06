import React from 'react';
import useOnline from '../hooks/useOnline';

interface SyncStatusProps {
  collapsed?: boolean;
}

export default function SyncStatus({ collapsed = false }: SyncStatusProps) {
  const online = useOnline();
  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          online ? 'bg-green-500' : 'bg-red-500'
        }`}
        title={online ? 'Online' : 'Offline'}
      />
      {!collapsed && <span>{online ? 'Online' : 'Offline'}</span>}
    </div>
  );
}
