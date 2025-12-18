import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Atalhos globais de teclado (apenas dentro da área autenticada).
 *
 * Combinações (Alt + Shift + tecla):
 * - D: Dashboard
 * - P: Nascimento/Desmama
 * - M: Matrizes
 * - N: Notificações
 * - F: Fazendas
 * - I: Importar Planilha
 * - U: Usuários (somente admin)
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Precisa de Alt + Shift
      if (!event.altKey || !event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingField =
        !!target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName || '') ||
          target.isContentEditable);

      // Não interferir quando o foco está em campos de digitação
      if (isTypingField) return;

      const key = event.key.toLowerCase();

      switch (key) {
        case 'd':
          event.preventDefault();
          navigate('/dashboard');
          break;
        case 'p':
          event.preventDefault();
          navigate('/planilha');
          break;
        case 'm':
          event.preventDefault();
          navigate('/matrizes');
          break;
        case 'n':
          event.preventDefault();
          navigate('/notificacoes');
          break;
        case 'f':
          event.preventDefault();
          navigate('/fazendas');
          break;
        case 'i':
          event.preventDefault();
          navigate('/importar-planilha');
          break;
        case 'u':
          if (!isAdmin()) return;
          event.preventDefault();
          navigate('/usuarios');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, isAdmin]);
}


