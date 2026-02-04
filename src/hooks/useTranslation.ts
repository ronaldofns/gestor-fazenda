import { useMemo } from 'react';
import { t } from '../i18n/pt-BR';

/**
 * Hook para usar traduções (i18n).
 * Retorna a função t(key) para o locale atual.
 * Preparado para futura troca de idioma via contexto.
 */
export function useTranslation() {
  return useMemo(() => ({ t }), []);
}
