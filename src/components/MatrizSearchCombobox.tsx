import { useState, useEffect, useRef } from 'react';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses } from '../utils/themeHelpers';
import { useDebounce } from '../hooks/useDebounce';

/** Item da lista: animal (fêmea) para campo Mãe */
export interface MatrizOuAnimalItem {
  id: string;
  label: string;
}

interface MatrizSearchComboboxProps {
  value: string | undefined;
  onChange: (matrizId: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  fazendaId?: string; // Filtrar por fazenda
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
}

/**
 * Combobox para busca de mãe (matriz): busca apenas em db.animais (fêmeas).
 */
export default function MatrizSearchCombobox({
  value,
  onChange,
  placeholder = "Digite o brinco ou nome da mãe...",
  label,
  error,
  required,
  fazendaId,
  className = "",
  containerClassName = "",
  disabled = false
}: MatrizSearchComboboxProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<MatrizOuAnimalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MatrizOuAnimalItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  const searchTerm = useDebounce(inputValue, 300);

  // Carregar animal (mãe) selecionado quando value mudar
  useEffect(() => {
    if (!value) {
      setSelectedItem(null);
      setInputValue('');
      return;
    }
    db.animais.get(value).then(animal => {
      if (animal && !animal.deletedAt) {
        const label = `${animal.brinco}${animal.nome ? ` - ${animal.nome}` : ''}`;
        setSelectedItem({ id: animal.id, label });
        setInputValue(label);
      } else {
        setSelectedItem(null);
        setInputValue('');
      }
    }).catch(err => {
      console.error('Erro ao carregar mãe:', err);
      setSelectedItem(null);
      setInputValue('');
    });
  }, [value]);

  // Busca apenas em db.animais (fêmeas)
  useEffect(() => {
    if (!isOpen || !searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const term = searchTerm.toLowerCase().trim();
    db.animais
      .filter(a => {
        if (a.deletedAt) return false;
        if (a.sexo !== 'F') return false;
        const fazendaMatch = !fazendaId || a.fazendaId === fazendaId;
        const brincoMatch = a.brinco?.toLowerCase().includes(term);
        const nomeMatch = a.nome?.toLowerCase().includes(term);
        return fazendaMatch && (brincoMatch || nomeMatch);
      })
      .limit(20)
      .toArray()
      .then(animais => {
        setSearchResults(animais.map(a => ({
          id: a.id,
          label: `${a.brinco}${a.nome ? ` - ${a.nome}` : ''}`
        })));
        setIsSearching(false);
      })
      .catch(err => {
        console.error('Erro ao buscar mães (animais):', err);
        setSearchResults([]);
        setIsSearching(false);
      });
  }, [searchTerm, isOpen, fazendaId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Scroll para opção destacada
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHighlightedIndex(-1);
    setIsOpen(true);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      setIsFocused(true);
      setIsOpen(true);
      setHighlightedIndex(-1);
      e.target.select();
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    if (selectedItem) {
      setInputValue(selectedItem.label);
    } else if (!isOpen) {
      setInputValue('');
    }
  };

  const handleSelect = (item: MatrizOuAnimalItem) => {
    setSelectedItem(item);
    setInputValue(item.label);
    onChange(item.id);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        setHighlightedIndex(prev => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0;
          setTimeout(() => {
            optionRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex(prev => {
          const next = prev > 0 ? prev - 1 : searchResults.length - 1;
          setTimeout(() => {
            optionRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelect(searchResults[highlightedIndex]!);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const showDropdown = isOpen && (searchResults.length > 0 || isSearching) && !disabled;

  // Se não tem label, usar o estilo antigo (sem fieldset)
  if (!label) {
    return (
      <div ref={containerRef} className={`flex-1 relative ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed ${className}`}
          placeholder={placeholder}
        />
      
      {/* Seta dropdown */}
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setHighlightedIndex(-1);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 10);
            }
          }
        }}
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        className={`absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer rounded-r-md transition-colors disabled:cursor-not-allowed focus:outline-none`}
        aria-label={isOpen ? 'Fechar lista' : 'Abrir lista'}
        tabIndex={-1}
      >
        {isSearching ? (
          <Icons.Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        ) : (
          <Icons.ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        )}
      </button>

        {/* Dropdown de resultados */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {isSearching ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                <Icons.Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                Buscando...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                {inputValue.length < 2 
                  ? 'Digite pelo menos 2 caracteres para buscar'
                  : 'Nenhuma fêmea encontrada'}
              </div>
            ) : (
              searchResults.map((item, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none transition-colors ${
                      isHighlighted 
                        ? 'bg-blue-100 dark:bg-blue-900/30' 
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="font-medium">{item.label}</div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // Com label - usar estrutura do Combobox
  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      {/* Caixa com borda */}
      <div
        className={`
          relative
          rounded-md
          border
          px-3
          pt-2
          pb-1
          bg-white
          dark:bg-slate-900
          transition-colors
          ${error
            ? 'border-red-500 dark:border-red-400'
            : isFocused || isOpen
              ? getThemeClasses(primaryColor, 'border')
              : 'border-gray-300 dark:border-slate-600'}
        `}
      >
        {/* Fake cut label */}
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
              ${error
                ? 'text-red-500 dark:text-red-400'
                : isFocused || isOpen
                  ? getThemeClasses(primaryColor, 'text')
                  : ''}
            `}
          >
            {label}
            {required && <span className="ml-1 text-red-500 dark:text-red-400">*</span>}
          </label>
        )}

        {/* Input fake */}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={`
              w-full
              bg-transparent
              border-0
              outline-none
              text-sm
              py-1
              pr-6
              text-slate-800
              dark:text-slate-100
              placeholder:text-gray-400
              dark:placeholder:text-slate-500
              disabled:cursor-not-allowed
              ${className}
            `}
            placeholder={placeholder}
          />
          
          {/* Seta dropdown */}
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                setHighlightedIndex(-1);
                if (!isOpen) {
                  setTimeout(() => inputRef.current?.focus(), 10);
                }
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            className={`absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer transition-colors disabled:cursor-not-allowed focus:outline-none`}
            aria-label={isOpen ? 'Fechar lista' : 'Abrir lista'}
            tabIndex={-1}
          >
            {isSearching ? (
              <Icons.Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <Icons.ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            )}
          </button>
        </div>
      </div>

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {isSearching ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
              <Icons.Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              Buscando...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
              {inputValue.length < 2 
                ? 'Digite pelo menos 2 caracteres para buscar'
                : 'Nenhuma fêmea encontrada'}
            </div>
          ) : (
            searchResults.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none transition-colors ${
                    isHighlighted 
                      ? 'bg-blue-100 dark:bg-blue-900/30' 
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium">{item.label}</div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
