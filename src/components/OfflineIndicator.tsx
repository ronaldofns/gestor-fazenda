import { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import useOnline from '../hooks/useOnline';

// Toast curto que só aparece na transição (entrada/saída do offline)
export default function OfflineIndicator() {
  const online = useOnline();
  const [showMessage, setShowMessage] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Sempre limpar timeout anterior
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // Exibir o toast por alguns segundos quando o status muda
    setShowMessage(true);
    timeoutRef.current = window.setTimeout(() => {
      setShowMessage(false);
    }, 3200);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [online]);

  if (!showMessage) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        showMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md shadow-lg text-sm ${
          online ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}
      >
        {online ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Conexão restaurada</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline: dados locais</span>
          </>
        )}
      </div>
    </div>
  );
}

