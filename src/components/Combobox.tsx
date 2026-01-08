import React, { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { Icons } from '../utils/iconMapping';

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
  // Props para favoritos
  favoritoTipo?: 'fazenda' | 'raca';
  isFavorito?: (value: string) => boolean;
  onToggleFavorito?: (value: string) => void;
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
  allowCustomValue = true,
  favoritoTipo,
  isFavorito,
  onToggleFavorito
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isPending, startTransition] = useTransition();

  // Normalizar opções para formato unificado
  const normalizeOptions = (opts: string[] | ComboboxOption[]): ComboboxOption[] => {
    return opts.map(opt => 
      typeof opt === 'string' ? { label: opt, value: opt } : opt
    );
  };

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);

  // Função para encontrar o label baseado no value
  const getLabelFromValue = (val: string): string => {
    if (!val) return '';
    // Normalizar comparação (trim e case-insensitive)
    const valNormalizado = val.trim().toLowerCase();
    const matchingOption = normalizedOptions.find(opt => 
      opt.value.trim().toLowerCase() === valNormalizado ||
      opt.label.trim().toLowerCase() === valNormalizado
    );
    return matchingOption ? matchingOption.label : val;
  };

  // Atualizar inputValue quando value prop mudar
  useEffect(() => {
    const label = getLabelFromValue(value);
    // Só atualizar se o label mudou para evitar resets desnecessários
    if (label !== inputValue) {
      setInputValue(label);
    }
  }, [value, options, normalizedOptions, inputValue]); // Só quando value prop mudar

  const filteredOptions = useMemo(() => {
    let opts = normalizedOptions;
    
    // Se há filtro de texto, aplicar
    if (inputValue && isOpen) {
      const exactMatch = normalizedOptions.find(opt =>
        opt.label.toLowerCase() === inputValue.toLowerCase() ||
        opt.value.toLowerCase() === inputValue.toLowerCase()
      );
      if (exactMatch) {
        opts = normalizedOptions;
      } else {
        opts = normalizedOptions.filter(opt =>
          opt.label.toLowerCase().includes(inputValue.toLowerCase()) ||
          opt.value.toLowerCase().includes(inputValue.toLowerCase())
        );
      }
    }
    
    // Ordenar: favoritos primeiro, depois os demais
    if (isFavorito) {
      return [...opts].sort((a, b) => {
        const aFav = isFavorito(a.value);
        const bFav = isFavorito(b.value);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      });
    }
    
    return opts;
  }, [inputValue, isOpen, normalizedOptions, isFavorito]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Resetar highlightedIndex quando filteredOptions mudar
  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(-1);
    }
  }, [filteredOptions.length, highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHighlightedIndex(-1); // Resetar índice destacado ao digitar
    startTransition(() => onChange(newValue));
    setIsOpen(true);
  };

  const handleSelect = (option: ComboboxOption) => {
    setInputValue(option.label);
    startTransition(() => onChange(option.value));
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      // Quando focar, se o valor atual corresponde exatamente a uma opção válida,
      // limpar o filtro para mostrar todas as opções
      const inputValueNormalizado = inputValue.trim().toLowerCase();
      const currentValueMatches = normalizedOptions.some(opt => 
        opt.label.trim().toLowerCase() === inputValueNormalizado ||
        opt.value.trim().toLowerCase() === inputValueNormalizado
      );
      
      // Se o valor atual corresponde a uma opção, mostrar todas as opções ao focar
      if (currentValueMatches) {
        // nada a fazer: filteredOptions já depende de normalizedOptions
      }
      
      setIsOpen(true);
      setHighlightedIndex(-1);
      // Selecionar todo o texto para facilitar digitação
      e.target.select();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          // Scroll para a opção destacada
          setTimeout(() => {
            optionRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          // Scroll para a opção destacada
          setTimeout(() => {
            optionRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (!allowCustomValue && filteredOptions.length === 1) {
        // Se não permite valor customizado e há apenas uma opção filtrada, selecionar
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === 'Tab') {
      // Fechar ao pressionar Tab
      setIsOpen(false);
      setHighlightedIndex(-1);
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
        {/* Seta indicadora de dropdown - clicável */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              const willOpen = !isOpen;
              setIsOpen(willOpen);
              setHighlightedIndex(-1);
              // Focar no input quando abrir (comportamento nativo)
              if (willOpen) {
                // Pequeno delay para garantir que o estado foi atualizado
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 10);
              } else {
                // Quando fechar, manter foco no input
                inputRef.current?.focus();
              }
            }
          }}
          onMouseDown={(e) => {
            // Prevenir que o input perca o foco ao clicar na seta
            // Isso permite que o onClick funcione corretamente
            e.preventDefault();
          }}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer rounded-r-md transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          aria-label={isOpen ? 'Fechar lista' : 'Abrir lista'}
          aria-expanded={isOpen}
          tabIndex={-1}
        >
          <Icons.ChevronDown className={`w-5 h-5 text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </button>
        {showDropdown && (
          <div 
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {filteredOptions.map((option, index) => {
              const isFav = isFavorito ? isFavorito(option.value) : false;
              const isHighlighted = index === highlightedIndex;
              return (
                <div
                  key={`${option.value}-${index}`}
                  className={`flex items-center group ${
                    isHighlighted 
                      ? 'bg-blue-50 dark:bg-blue-900/40' 
                      : 'hover:bg-blue-50 dark:hover:bg-blue-900/40'
                  }`}
                >
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex-1 text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none transition-colors ${
                      isHighlighted ? 'bg-blue-50 dark:bg-blue-900/40' : ''
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.label}
                  </button>
                  {onToggleFavorito && favoritoTipo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorito(option.value);
                      }}
                      className="px-2 py-2 text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                      title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <Icons.Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  )}
                </div>
              );
            })}
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
          <Icons.Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default React.memo(ComboboxComponent);

