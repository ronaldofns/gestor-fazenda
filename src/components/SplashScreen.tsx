import { useEffect, useState } from 'react';
import { getThemeClasses } from '../utils/themeHelpers';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  
  useEffect(() => {
    // Esconder splash screen após tempo mínimo (garantir visualização)
    const minDisplayTime = 2500; // Tempo mínimo de exibição em ms
    const startTime = Date.now();

    const hideSplash = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDisplayTime - elapsed);
      
      setTimeout(() => {
        setShow(false);
      }, remaining);
    };

    // Aguardar carregamento completo antes de esconder
    if (document.readyState === 'complete') {
      hideSplash();
    } else {
      window.addEventListener('load', hideSplash, { once: true });
    }

    // Fallback: esconder após tempo máximo (4 segundos)
    const maxTimer = setTimeout(() => {
      setShow(false);
    }, 4000);

    return () => {
      clearTimeout(maxTimer);
      window.removeEventListener('load', hideSplash);
    };
  }, []);

  if (!show) return null;



  return (
    <div className={`fixed inset-0 z-[9999] bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center`}>
      <div className="text-center">
        {/* Logo/Ícone */}
        <div className="mb-6 animate-pulse">
          <div className={`w-24 h-24 mx-auto bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-to')} rounded-2xl shadow-xl flex items-center justify-center overflow-hidden`}>
            <img 
              src="/logo192.png" 
              alt="Gestor Fazenda" 
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                // Fallback se a imagem não carregar
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  `;
                }
              }}
            />
          </div>
        </div>
        
        {/* Nome do App */}
<h1 className="text-3xl font-bold text-gray-900 mb-2">
  Gerenciador de Fazendas
</h1>

<p className="text-gray-600 mb-1">
  Controle completo do rebanho com tecnologia offline-first.
</p>

<p className="text-sm text-gray-500 mb-8">
  Produtividade, indicadores e histórico sempre disponíveis, mesmo no campo.
</p>
        
        {/* Loading Spinner */}
        <div className="flex justify-center">
          <div className={`w-12 h-12 border-4 ${getThemeClasses(primaryColor, 'border')} border-t-transparent rounded-full animate-spin`}></div>
        </div>
      </div>
    </div>
  );
}

