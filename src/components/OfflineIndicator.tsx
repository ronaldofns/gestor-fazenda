import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import useOnline from '../hooks/useOnline';

export default function OfflineIndicator() {
  const online = useOnline();
  const [wasOffline, setWasOffline] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowMessage(true);
    } else if (wasOffline && online) {
      // Mostrar mensagem de reconexão
      setShowMessage(true);
      setTimeout(() => {
        setShowMessage(false);
      }, 3000);
      setWasOffline(false);
    }
  }, [online, wasOffline]);

  if (!showMessage) return null;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
      showMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    }`}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
        online 
          ? 'bg-green-500 text-white' 
          : 'bg-red-500 text-white'
      }`}>
        {online ? (
          <>
            <Wifi className="w-5 h-5" />
            <span className="text-sm font-medium">Conexão restaurada! Sincronizando dados...</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="text-sm font-medium">Você está offline. Trabalhando com dados locais.</span>
          </>
        )}
      </div>
    </div>
  );
}

