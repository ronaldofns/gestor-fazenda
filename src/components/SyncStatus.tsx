import React from 'react';
import useOnline from '../hooks/useOnline';

export default function SyncStatus() {
  const online = useOnline();
  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          online ? 'bg-green-500' : 'bg-red-500'
        }`}
        title={online ? 'Online' : 'Offline'}
      />
      <span>{online ? 'Online' : 'Offline'}</span>
    </div>
  );
}
