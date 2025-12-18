import React, { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export interface ComboboxOption {
  label: string;
  value: string;
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[] | ComboboxOption[];
  placeholder?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  className?: string;
  disabled?: boolean;
  allowCustomValue?: boolean; // Permite valores que não estão na lista
}

function ComboboxComponent({
  value,
  onChange,
  options,
  placeholder = "Digite ou selecione",
  onAddNew,
  addNewLabel = "Adicionar novo",
  className = "",
  disabled = false,
  allowCustomValue = true
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Normalizar opções para formato unificado
  const normalizeOptions = (opts: string[] | ComboboxOption[]): ComboboxOption[] => {
    return opts.map(opt => 
      typeof opt === 'string' ? { label: opt, value: opt } : opt
    );
  };

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);

  // Função para encontrar o label baseado no value
  const getLabelFromValue = (val: string, opts: string[] | ComboboxOption[]): string => {
    if (!val) return '';
    const matchingOption = normalizedOptions.find(opt => opt.value === val);
    return matchingOption ? matchingOption.label : val;
  };

  // Atualizar inputValue quando value prop mudar
  useEffect(() => {
    const label = getLabelFromValue(value, options);
    // Só atualizar se o label mudou para evitar resets desnecessários
    if (label !== inputValue) {
      setInputValue(label);
    }
  }, [value, options, normalizedOptions]); // Só quando value prop mudar

  const filteredOptions = useMemo(() => {
    if (!inputValue || !isOpen) return normalizedOptions;
    const exactMatch = normalizedOptions.find(opt =>
      opt.label.toLowerCase() === inputValue.toLowerCase() ||
      opt.value.toLowerCase() === inputValue.toLowerCase()
    );
    if (exactMatch) return normalizedOptions;
    return normalizedOptions.filter(opt =>
      opt.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      opt.value.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [inputValue, isOpen, normalizedOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    startTransition(() => onChange(newValue));
    setIsOpen(true);
  };

  const handleSelect = (option: ComboboxOption) => {
    setInputValue(option.label);
    startTransition(() => onChange(option.value));
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      // Quando focar, se o valor atual corresponde exatamente a uma opção válida,
      // limpar o filtro para mostrar todas as opções
      const currentValueMatches = normalizedOptions.some(opt => 
        opt.label === inputValue || opt.value === inputValue
      );
      
      // Se o valor atual corresponde a uma opção, mostrar todas as opções ao focar
      if (currentValueMatches) {
        // nada a fazer: filteredOptions já depende de normalizedOptions
      }
      
      setIsOpen(true);
      // Selecionar todo o texto para facilitar digitação
      e.target.select();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
      e.preventDefault();
    } else if (e.key === 'Enter' && !allowCustomValue && filteredOptions.length === 1) {
      // Se não permite valor customizado e há apenas uma opção filtrada, selecionar
      if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0]);
        e.preventDefault();
      }
    }
  };

  const handleBlur = () => {
    // Se não permite valor customizado e o valor não está nas opções, limpar ou usar o valor mais próximo
    if (!allowCustomValue && inputValue) {
      const exactMatch = normalizedOptions.find(opt => 
        opt.label.toLowerCase() === inputValue.toLowerCase() ||
        opt.value.toLowerCase() === inputValue.toLowerCase()
      );
      if (!exactMatch && normalizedOptions.length > 0) {
        // Tentar encontrar a primeira opção que começa com o valor digitado
        const partialMatch = normalizedOptions.find(opt =>
          opt.label.toLowerCase().startsWith(inputValue.toLowerCase())
        );
        if (partialMatch) {
          setInputValue(partialMatch.label);
          onChange(partialMatch.value);
        }
      }
    }
  };

  const showDropdown = isOpen && filteredOptions.length > 0 && !disabled;

  return (
    <div className={`flex gap-2 ${className}`}>
      <div ref={containerRef} className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          aria-busy={isPending}
          className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
          placeholder={placeholder}
        />
        {/* Seta indicadora de dropdown */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown className={`w-5 h-5 text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </div>
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredOptions.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-900/40 focus:bg-blue-50 dark:focus:bg-blue-900/40 focus:outline-none transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {onAddNew && (
        <button
          type="button"
          onClick={onAddNew}
          disabled={disabled}
          className="px-3 py-2 text-sm bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          title={addNewLabel}
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default React.memo(ComboboxComponent);

