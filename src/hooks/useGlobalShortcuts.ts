import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { showToast } from '../utils/toast';
import { useKeyboardShortcut } from './useKeyboardShortcut';

/**
 * Hook que registra atalhos globais do sistema
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navegação
  useKeyboardShortcut({
    key: 'd',
    ctrl: true,
    action: () => {
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
        showToast({ type: 'info', message: 'Dashboard', duration: 1500 });
      }
    },
  });

  useKeyboardShortcut({
    key: 'h',
    ctrl: true,
    action: () => {
      if (location.pathname !== '/planilha') {
        navigate('/planilha');
        showToast({ type: 'info', message: 'Nascimentos', duration: 1500 });
      }
    },
  });

  useKeyboardShortcut({
    key: 'm',
    ctrl: true,
    action: () => {
      if (location.pathname !== '/matrizes') {
        navigate('/matrizes');
        showToast({ type: 'info', message: 'Matrizes', duration: 1500 });
      }
    },
  });

  useKeyboardShortcut({
    key: 'f',
    ctrl: true,
    action: () => {
      if (location.pathname !== '/fazendas') {
        navigate('/fazendas');
        showToast({ type: 'info', message: 'Fazendas', duration: 1500 });
      }
    },
  });

  useKeyboardShortcut({
    key: 'u',
    ctrl: true,
    action: () => {
      if (location.pathname !== '/usuarios') {
        navigate('/usuarios');
        showToast({ type: 'info', message: 'Usuários', duration: 1500 });
      }
    },
  });

  useKeyboardShortcut({
    key: 'p',
    ctrl: true,
    action: () => {
      if (location.pathname !== '/perfil') {
        navigate('/perfil');
        showToast({ type: 'info', message: 'Perfil', duration: 1500 });
      }
    },
  });

  // Tema
  useKeyboardShortcut({
    key: 't',
    ctrl: true,
    shift: true,
    action: () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        showToast({ type: 'success', message: 'Tema Claro ativado', duration: 1500 });
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        showToast({ type: 'success', message: 'Tema Escuro ativado', duration: 1500 });
      }
    },
  });

  // Sidebar toggle
  useKeyboardShortcut({
    key: 'b',
    ctrl: true,
    action: () => {
      const currentState = localStorage.getItem('sidebarCollapsed') === 'true';
      const newState = !currentState;
      localStorage.setItem('sidebarCollapsed', String(newState));
      
      window.dispatchEvent(
        new CustomEvent('sidebarToggle', { 
          detail: { collapsed: newState } 
        })
      );
      
      showToast({ 
        type: 'info', 
        message: newState ? 'Sidebar recolhida' : 'Sidebar expandida',
        duration: 1500 
      });
    },
  });

  // Sincronização
  useKeyboardShortcut({
    key: 's',
    ctrl: true,
    action: () => {
      // Disparar evento personalizado de sincronização
      window.dispatchEvent(new CustomEvent('triggerSync'));
      showToast({ type: 'info', message: 'Sincronizando...', duration: 1500 });
    },
  });

  // Configurações
  useKeyboardShortcut({
    key: ',',
    ctrl: true,
    action: () => {
      // Disparar evento para abrir configurações
      window.dispatchEvent(new CustomEvent('openSettings'));
      showToast({ type: 'info', message: 'Configurações', duration: 1500 });
    },
  });

  // Fechar modais com ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Disparar evento personalizado para fechar modais
        window.dispatchEvent(new CustomEvent('closeModals'));
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
}
