import { useState, useEffect } from 'react';

/**
 * Hook para fazer debounce de valores
 * Evita execuções excessivas ao digitar em campos de busca
 * @param value Valor a ser "debouncado"
 * @param delay Delay em ms (padrão: 300ms)
 * @returns Valor com debounce aplicado
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Criar timer para atualizar o valor após o delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: cancelar timer se o valor mudar antes do delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
