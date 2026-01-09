import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppSettings } from './useAppSettings';

/**
 * Hook para detectar inatividade do usuário e fazer logout automático
 * Monitora eventos de mouse, teclado, scroll e touch
 */
export function useInactivityTimeout() {
  const { user, logout } = useAuth();
  const { appSettings } = useAppSettings();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimeout = useCallback(() => {
    if (!user) return;

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Obter timeout configurado (em minutos, converter para ms)
    const timeoutMinutes = appSettings.timeoutInatividade || 15;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    // Atualizar última atividade
    lastActivityRef.current = Date.now();

    // Configurar novo timeout
    timeoutRef.current = setTimeout(() => {
      // Verificar se ainda está inativo (sem atividade desde o último reset)
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= timeoutMs) {
        console.log(`[InactivityTimeout] Logout automático após ${timeoutMinutes} minutos de inatividade`);
        logout();
      }
    }, timeoutMs);
  }, [user, logout, appSettings.timeoutInatividade]);

  useEffect(() => {
    if (!user) {
      // Limpar timeout se não houver usuário logado
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimeout();
    };

    // Adicionar listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timeout inicial
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, resetTimeout]);
}
