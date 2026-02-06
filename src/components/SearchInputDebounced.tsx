import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Input from './Input';

export interface SearchInputDebouncedProps {
  label: string;
  placeholder?: string;
  /** Chamado com o valor debounced (após o usuário parar de digitar) */
  onSearchChange: (value: string) => void;
  /** Valor inicial / para sincronizar quando limpar filtros externamente */
  defaultValue?: string;
  delay?: number;
}

export interface SearchInputDebouncedRef {
  clear: () => void;
}

/**
 * Input de busca que mantém estado local para digitação fluida.
 * Só notifica o pai (onSearchChange) após o debounce — evita re-renders pesados no pai a cada tecla.
 */
const SearchInputDebounced = forwardRef<SearchInputDebouncedRef, SearchInputDebouncedProps>(
  function SearchInputDebounced({ label, placeholder, onSearchChange, defaultValue = '', delay = 300 }, ref) {
    const [localValue, setLocalValue] = useState(defaultValue);

    useImperativeHandle(ref, () => ({
      clear: () => {
        setLocalValue('');
        onSearchChange('');
      }
    }), [onSearchChange]);

    // Debounce: notificar pai após o usuário parar de digitar
    useEffect(() => {
      const timer = setTimeout(() => {
        onSearchChange(localValue);
      }, delay);
      return () => clearTimeout(timer);
    }, [localValue, delay]);

    // Sincronizar quando o pai limpa (ex: "Limpar filtros")
    useEffect(() => {
      if (defaultValue === '' && localValue !== '') {
        setLocalValue('');
      }
    }, [defaultValue]);

    return (
      <Input
        label={label}
        value={localValue}
        placeholder={placeholder}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    );
  }
);

export default SearchInputDebounced;
