import { memo, useState, useMemo } from 'react';
import { Icons } from '../utils/iconMapping';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  entityType: 'nascimento' | 'matriz' | 'fazenda' | 'animal';
  disabled?: boolean;
  label?: string;
}

const TagSelector = memo(function TagSelector({
  selectedTagIds,
  onChange,
  entityType,
  disabled = false,
  label = 'Tags'
}: TagSelectorProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Carregar tags do Dexie
  const allTags = useLiveQuery(
    () => db.tags
      .filter(tag => !tag.deletedAt)
      .toArray()
      .then(tags => tags.sort((a, b) => a.name.localeCompare(b.name))),
    []
  ) ?? [];

  // Filtrar tags por busca
  const filteredTags = useMemo(() => {
    if (!searchQuery) return allTags;
    const query = searchQuery.toLowerCase();
    return allTags.filter(tag =>
      tag.name.toLowerCase().includes(query) ||
      tag.category?.toLowerCase().includes(query) ||
      tag.description?.toLowerCase().includes(query)
    );
  }, [allTags, searchQuery]);

  // Tags selecionadas
  const selectedTags = useMemo(() => {
    return allTags.filter(tag => selectedTagIds.includes(tag.id));
  }, [allTags, selectedTagIds]);

  const toggleTag = (tagId: string) => {
    if (disabled) return;
    
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    if (disabled) return;
    onChange(selectedTagIds.filter(id => id !== tagId));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
        {label}
      </label>

      {/* Tags selecionadas */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
          {selectedTags.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => removeTag(tag.id)}
              disabled={disabled}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: tag.color }}
              title={tag.description || tag.name}
            >
              <span>{tag.name}</span>
              <Icons.X className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {/* Botão para adicionar tags */}
      <div className="relative z-10">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-slate-300"
        >
          <span className="flex items-center gap-2">
            <Icons.Tag className="w-4 h-4" />
            <span>
              {selectedTags.length > 0
                ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selecionada${selectedTags.length > 1 ? 's' : ''}`
                : 'Adicionar tags'}
            </span>
          </span>
          <Icons.ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown de tags */}
        {isOpen && !disabled && (
          <>
            {/* Overlay invisível para fechar ao clicar fora - usar absolute ao invés de fixed */}
            <div
              className="fixed inset-0 z-[9]"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{ pointerEvents: 'auto' }}
            />
            
            {/* Dropdown */}
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl max-h-80 flex flex-col">
            {/* Busca */}
            <div className="p-3 border-b border-gray-200 dark:border-slate-700">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tags..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de tags */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTags.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Icons.Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag criada ainda'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs mt-1">
                      Crie tags em Configurações → Tags
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-slate-500'
                        }`}>
                          {isSelected && (
                            <Icons.Check className="w-3 h-3 text-white" />
                          )}
                        </div>

                        {/* Cor da tag */}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />

                        {/* Nome e detalhes */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">
                              {tag.name}
                            </span>
                            {tag.category && (
                              <span className="text-xs text-gray-500 dark:text-slate-400 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">
                                {tag.category}
                              </span>
                            )}
                          </div>
                          {tag.description && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                              {tag.description}
                            </p>
                          )}
                        </div>

                        {/* Contador de uso */}
                        <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                          {tag.usageCount}×
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full px-3 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-md ${getPrimaryButtonClass(primaryColor)}`}
              >
                Concluir
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
});

export default TagSelector;
