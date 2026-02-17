import { useState, useEffect, useRef } from "react";
import { db } from "../db/dexieDB";
import { Animal } from "../db/models";
import { Icons } from "../utils/iconMapping";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getThemeClasses } from "../utils/themeHelpers";
import { useDebounce } from "../hooks/useDebounce";
interface AnimalSearchComboboxProps {
  value: string | undefined;
  onChange: (animalId: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  excludeAnimalId?: string; // Para não permitir selecionar a si mesmo
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  onAddNew?: () => void; // Callback para abrir modal de novo animal
  addNewLabel?: string; // Texto do botão
}

/**
 * Combobox otimizado para busca de animais
 * Busca assíncrona apenas quando o usuário digita (evita carregar 900+ animais)
 */
export default function AnimalSearchCombobox({
  value,
  onChange,
  placeholder = "Digite o brinco ou nome...",
  label,
  error,
  required,
  excludeAnimalId,
  className = "",
  containerClassName = "",
  disabled = false,
  onAddNew,
  addNewLabel = "Novo animal",
}: AnimalSearchComboboxProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;

  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Debounce na busca (300ms)
  const searchTerm = useDebounce(inputValue, 300);

  // Carregar animal selecionado quando value mudar
  useEffect(() => {
    if (value) {
      // Verificar se o animal já está carregado e corresponde ao value
      if (selectedAnimal && selectedAnimal.id === value) {
        // Já está carregado e correto, não precisa recarregar
        return;
      }

      // Carregar o animal pelo ID
      db.animais
        .get(value)
        .then((animal) => {
          if (animal) {
            setSelectedAnimal(animal);
            setInputValue(
              `${animal.brinco}${animal.nome ? ` - ${animal.nome}` : ""}`,
            );
          } else {
            // Animal não encontrado, limpar
            setSelectedAnimal(null);
            setInputValue("");
          }
        })
        .catch((err) => {
          console.error("Erro ao carregar animal:", err);
          setSelectedAnimal(null);
          setInputValue("");
        });
    } else {
      // Sem value, limpar
      setSelectedAnimal(null);
      setInputValue("");
    }
  }, [value]); // Remover selectedAnimal das dependências para evitar loop

  // Busca assíncrona quando o usuário digita
  useEffect(() => {
    const term = searchTerm?.trim() ?? "";
    const minChars = term.length >= 1 ? 1 : 2;
    if (!isOpen || !term || term.length < minChars) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const termLower = term.toLowerCase();
    // Brinco pode vir como string ou número do banco; normalizar para string
    const brincoStr = (v: unknown) =>
      String(v ?? "")
        .trim()
        .toLowerCase();
    const nomeStr = (v: unknown) =>
      String(v ?? "")
        .trim()
        .toLowerCase();

    db.animais
      .filter((a) => {
        if (a.deletedAt) return false;
        if (excludeAnimalId && a.id === excludeAnimalId) return false;
        const b = brincoStr(a.brinco);
        const n = nomeStr(a.nome);
        return b.includes(termLower) || n.includes(termLower);
      })
      .toArray()
      .then((results) => {
        // Ordenar por relevância e exibir no máximo 20
        const sorted = [...results].sort((a, b) => {
          const brincoA = brincoStr(a.brinco);
          const brincoB = brincoStr(b.brinco);
          const nomeA = nomeStr(a.nome);
          const nomeB = nomeStr(b.nome);
          const scoreA =
            (brincoA === termLower ? 40 : 0) +
            (brincoA.startsWith(termLower) ? 30 : 0) +
            (brincoA.includes(termLower) ? 20 : 0) +
            (nomeA.startsWith(termLower) ? 10 : 0) +
            (nomeA.includes(termLower) ? 5 : 0);
          const scoreB =
            (brincoB === termLower ? 40 : 0) +
            (brincoB.startsWith(termLower) ? 30 : 0) +
            (brincoB.includes(termLower) ? 20 : 0) +
            (nomeB.startsWith(termLower) ? 10 : 0) +
            (nomeB.includes(termLower) ? 5 : 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return brincoA.localeCompare(brincoB);
        });
        setSearchResults(sorted.slice(0, 20));
        setIsSearching(false);
      })
      .catch((err) => {
        console.error("Erro ao buscar animais:", err);
        setIsSearching(false);
      });
  }, [searchTerm, isOpen, excludeAnimalId]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        // Restaurar valor selecionado se houver
        if (selectedAnimal) {
          setInputValue(
            `${selectedAnimal.brinco}${selectedAnimal.nome ? ` - ${selectedAnimal.nome}` : ""}`,
          );
        }
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, selectedAnimal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedAnimal(null);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Se limpar o campo, limpar seleção
    if (!newValue.trim()) {
      onChange("");
    }
  };

  const handleSelect = (animal: Animal) => {
    setSelectedAnimal(animal);
    setInputValue(`${animal.brinco}${animal.nome ? ` - ${animal.nome}` : ""}`);
    onChange(animal.id);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsFocused(true);
      setIsOpen(true);
      setHighlightedIndex(-1);
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    // Restaurar valor selecionado se houver
    if (selectedAnimal) {
      setInputValue(
        `${selectedAnimal.brinco}${selectedAnimal.nome ? ` - ${selectedAnimal.nome}` : ""}`,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0;
          setTimeout(() => {
            optionRefs.current[next]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }, 0);
          return next;
        });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : searchResults.length - 1;
          setTimeout(() => {
            optionRefs.current[next]?.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }, 0);
          return next;
        });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        isOpen &&
        highlightedIndex >= 0 &&
        highlightedIndex < searchResults.length
      ) {
        handleSelect(searchResults[highlightedIndex]);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const showDropdown =
    isOpen && (searchResults.length > 0 || isSearching) && !disabled;

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
          className={`w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} ${getThemeClasses(primaryColor, "border")} disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed ${className}`}
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
          aria-label={isOpen ? "Fechar lista" : "Abrir lista"}
          tabIndex={-1}
        >
          {isSearching ? (
            <Icons.Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <Icons.ChevronDown
              className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? "transform rotate-180" : ""}`}
            />
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
              <div>
                <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                  {inputValue.trim().length < 1
                    ? "Digite o brinco ou nome para buscar"
                    : "Nenhum animal encontrado"}
                </div>
                {onAddNew && (
                  <>
                    <div className="border-t border-gray-200 dark:border-slate-700"></div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onAddNew();
                      }}
                      className="w-full px-3 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
                    >
                      <Icons.Plus className="w-4 h-4" />
                      {addNewLabel}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {searchResults.map((animal, index) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <button
                      key={animal.id}
                      ref={(el) => {
                        optionRefs.current[index] = el;
                      }}
                      type="button"
                      onClick={() => handleSelect(animal)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none transition-colors ${
                        isHighlighted
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "hover:bg-gray-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className="font-medium">{animal.brinco}</div>
                      {animal.nome && (
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {animal.nome}
                        </div>
                      )}
                    </button>
                  );
                })}
                {onAddNew && (
                  <>
                    <div className="border-t border-gray-200 dark:border-slate-700"></div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onAddNew();
                      }}
                      className="w-full px-3 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
                    >
                      <Icons.Plus className="w-4 h-4" />
                      {addNewLabel}
                    </button>
                  </>
                )}
              </>
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
          ${
            error
              ? "border-red-500 dark:border-red-400"
              : isFocused || isOpen
                ? getThemeClasses(primaryColor, "border")
                : "border-gray-300 dark:border-slate-600"
          }
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
              ${
                error
                  ? "text-red-500 dark:text-red-400"
                  : isFocused || isOpen
                    ? getThemeClasses(primaryColor, "text")
                    : ""
              }
            `}
          >
            {label}
            {required && (
              <span className="ml-1 text-red-500 dark:text-red-400">*</span>
            )}
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
            aria-label={isOpen ? "Fechar lista" : "Abrir lista"}
            tabIndex={-1}
          >
            {isSearching ? (
              <Icons.Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <Icons.ChevronDown
                className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? "transform rotate-180" : ""}`}
              />
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
            <div>
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                {inputValue.trim().length < 1
                  ? "Digite o brinco ou nome para buscar"
                  : "Nenhum animal encontrado"}
              </div>
              {onAddNew && (
                <>
                  <div className="border-t border-gray-200 dark:border-slate-700"></div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="w-full px-3 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Icons.Plus className="w-4 h-4" />
                    {addNewLabel}
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {searchResults.map((animal, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={animal.id}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => handleSelect(animal)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none transition-colors ${
                      isHighlighted
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "hover:bg-gray-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <div className="font-medium">{animal.brinco}</div>
                    {animal.nome && (
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {animal.nome}
                      </div>
                    )}
                  </button>
                );
              })}
              {onAddNew && (
                <>
                  <div className="border-t border-gray-200 dark:border-slate-700"></div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="w-full px-3 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Icons.Plus className="w-4 h-4" />
                    {addNewLabel}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
