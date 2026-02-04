import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import { Tag } from '../db/models';

export type TagFilterMode = 'any' | 'all';

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tagIds: string[]) => void;
  filterMode: TagFilterMode;
  onFilterModeChange: (mode: TagFilterMode) => void;
  category?: 'nascimento' | 'matriz' | 'fazenda';
  className?: string;
}

/**
 * Componente de filtro por tags
 * @param selectedTags IDs das tags selecionadas
 * @param onTagsChange Callback quando tags são selecionadas/deselecionadas
 * @param filterMode Modo de filtro ('any' = qualquer tag, 'all' = todas as tags)
 * @param onFilterModeChange Callback quando modo de filtro muda
 * @param category Categoria de tags a exibir (opcional)
 * @param className Classes CSS adicionais
 */
export default function TagFilter({
  selectedTags,
  onTagsChange,
  filterMode,
  onFilterModeChange,
  category,
  className = '',
}: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Buscar todas as tags disponíveis
  const allTags = useLiveQuery(() => {
    let query = db.tags.filter(t => !t.deletedAt);
    if (category) {
      query = query.filter(t => t.category === category);
    }
    return query.toArray();
  }, [category]);

  const tags = useMemo(() => allTags || [], [allTags]);

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          selectedTags.length > 0
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
        }`}
      >
        <Icons.Tag className="w-4 h-4" />
        <span className="text-sm font-medium">
          Filtrar por tags {selectedTags.length > 0 && `(${selectedTags.length})`}
        </span>
        <Icons.ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-20 max-h-96 overflow-hidden flex flex-col">
            {/* Header com modo de filtro */}
            <div className="p-3 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase">
                  Modo de filtro
                </span>
                {selectedTags.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onFilterModeChange('any')}
                  className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    filterMode === 'any'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Qualquer tag
                </button>
                <button
                  onClick={() => onFilterModeChange('all')}
                  className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  Todas as tags
                </button>
              </div>
            </div>

            {/* Lista de tags */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-2">
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTag(tag.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                          {tag.name}
                        </div>
                        {tag.description && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                            {tag.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Footer com contador */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
              <div className="text-xs text-gray-600 dark:text-slate-400">
                {selectedTags.length === 0 ? (
                  <span>Nenhuma tag selecionada</span>
                ) : selectedTags.length === 1 ? (
                  <span>1 tag selecionada</span>
                ) : (
                  <span>{selectedTags.length} tags selecionadas</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
