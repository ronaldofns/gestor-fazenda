import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';

export interface ComboboxOption {
  label: string;
  value: string;
}

export interface ComboboxProps {
  label?: string;
  value: string | undefined | null;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustomValue?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  className?: string;
  containerClassName?: string;
}

export default function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  error,
  required = false,
  disabled = false,
  allowCustomValue = true,
  onAddNew,
  addNewLabel = 'Adicionar',
  className = '',
  containerClassName = ''
}: ComboboxProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encontrar a opção selecionada
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption?.label || value || '';

  // Filtrar opções baseado na busca
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);

    // Se permitir valores customizados, atualizar imediatamente
    if (allowCustomValue) {
      onChange(newValue);
    }
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
      setSearchTerm('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div ref={containerRef} className={`relative mb-2 ${containerClassName}`}>
      {/* Container com borda */}
      <div
        className={`
          relative
          rounded-md
          border
          px-3
          pt-2
          pb-2
          bg-white
          dark:bg-slate-900
          transition-colors
          ${error
            ? 'border-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-slate-600'}
        `}
      >
        {/* Label */}
        {label && (
          <label
            className={`
              absolute
              -top-2
              left-3
              px-1
              text-[11px]
              font-medium
              bg-white
              dark:bg-slate-900
              text-slate-500
              dark:text-slate-400
              pointer-events-none
              transition-colors
              ${error ? 'text-red-500 dark:text-red-400' : ''}
            `}
          >
            {label}
            {required && <span className="ml-1 text-red-500 dark:text-red-400">*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className="flex items-center justify-between gap-2">
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={`
              flex-1
              min-w-0
              bg-transparent
              border-0
              outline-none
              text-sm
              leading-tight
              px-0
              py-0.5
              text-slate-800
              dark:text-slate-100
              placeholder:text-gray-400
              dark:placeholder:text-slate-500
              disabled:cursor-not-allowed
              disabled:opacity-50
              ${className}
            `}
          />

          {/* Botão Adicionar Novo */}
          {onAddNew && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddNew();
              }}
              disabled={disabled}
              className={`
                flex-shrink-0
                ${getPrimaryButtonClass(primaryColor)}
                text-white
                px-2.5
                py-1.5
                rounded-md
                focus:outline-none
                focus:ring-2
                focus:ring-offset-2
                transition-colors
                disabled:opacity-50
                disabled:cursor-not-allowed
              `}
              title={addNewLabel}
            >
              <Icons.Plus className="w-4 h-4" />
            </button>
          )}

          {/* Ícone Dropdown */}
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                if (!isOpen) {
                  inputRef.current?.focus();
                }
              }
            }}
            disabled={disabled}
            className="flex-shrink-0 p-0 bg-transparent border-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none"
          >
            <Icons.ChevronDown
              className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown com opções */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
              Nenhuma opção encontrada
            </div>
          ) : (
            <div className="py-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full
                    text-left
                    px-3
                    py-2
                    text-sm
                    transition-colors
                    ${option.value === value
                      ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
