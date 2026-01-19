import { useState, useMemo, memo } from 'react';
import { Icons } from '../utils/iconMapping';
import { useSavedFilters, FilterCondition, SavedFilter } from '../hooks/useSavedFilters';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses } from '../utils/themeHelpers';
import Modal from './Modal';
import { showToast } from '../utils/toast';

interface AdvancedFiltersProps {
  scope: string;
  fields: Array<{
    value: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    options?: Array<{ value: any; label: string }>;
  }>;
  onApplyFilter: (conditions: FilterCondition[]) => void;
  currentConditions?: FilterCondition[];
}

const OPERATORS = {
  text: [
    { value: 'equals', label: 'Igual a' },
    { value: 'contains', label: 'Contém' },
    { value: 'startsWith', label: 'Começa com' },
    { value: 'endsWith', label: 'Termina com' }
  ],
  number: [
    { value: 'equals', label: 'Igual a' },
    { value: 'greaterThan', label: 'Maior que' },
    { value: 'lessThan', label: 'Menor que' },
    { value: 'between', label: 'Entre' }
  ],
  date: [
    { value: 'equals', label: 'Igual a' },
    { value: 'greaterThan', label: 'Depois de' },
    { value: 'lessThan', label: 'Antes de' },
    { value: 'between', label: 'Entre' }
  ],
  boolean: [
    { value: 'equals', label: 'Igual a' }
  ],
  select: [
    { value: 'equals', label: 'Igual a' },
    { value: 'in', label: 'É um de' },
    { value: 'notIn', label: 'Não é nenhum de' }
  ]
};

const AdvancedFilters = memo(function AdvancedFilters({
  scope,
  fields,
  onApplyFilter,
  currentConditions = []
}: AdvancedFiltersProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  
  const {
    savedFilters,
    favoriteFilters,
    recentFilters,
    saveFilter,
    deleteFilter,
    toggleFavorite,
    markFilterAsUsed,
    duplicateFilter,
    exportFilters,
    importFilters
  } = useSavedFilters(scope);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'saved' | 'favorites' | 'recent'>('current');
  const [conditions, setConditions] = useState<FilterCondition[]>(currentConditions);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');

  // Adicionar nova condição
  const addCondition = () => {
    const newCondition: FilterCondition = {
      field: fields[0]?.value || '',
      operator: 'equals',
      value: ''
    };
    setConditions(prev => [...prev, newCondition]);
  };

  // Remover condição
  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  // Atualizar condição
  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setConditions(prev =>
      prev.map((condition, i) =>
        i === index ? { ...condition, ...updates } : condition
      )
    );
  };

  // Aplicar filtro
  const handleApply = () => {
    onApplyFilter(conditions);
    setIsOpen(false);
    showToast({ type: 'success', message: `${conditions.length} filtro(s) aplicado(s)` });
  };

  // Limpar filtros
  const handleClear = () => {
    setConditions([]);
    onApplyFilter([]);
    showToast({ type: 'info', message: 'Filtros removidos' });
  };

  // Salvar filtro atual
  const handleSaveFilter = () => {
    if (!filterName.trim()) {
      showToast({ type: 'error', message: 'Digite um nome para o filtro' });
      return;
    }

    if (conditions.length === 0) {
      showToast({ type: 'error', message: 'Adicione pelo menos uma condição' });
      return;
    }

    saveFilter(filterName, conditions, filterDescription);
    setFilterName('');
    setFilterDescription('');
    setSaveModalOpen(false);
    showToast({ type: 'success', message: 'Filtro salvo com sucesso!' });
  };

  // Carregar filtro salvo
  const loadSavedFilter = (filter: SavedFilter) => {
    setConditions(filter.conditions);
    markFilterAsUsed(filter.id);
    setActiveTab('current');
    showToast({ type: 'success', message: `Filtro "${filter.name}" carregado` });
  };

  // Obter operadores disponíveis para um campo
  const getOperatorsForField = (fieldValue: string) => {
    const field = fields.find(f => f.value === fieldValue);
    if (!field) return OPERATORS.text;
    return OPERATORS[field.type] || OPERATORS.text;
  };

  // Obter opções de um campo select
  const getFieldOptions = (fieldValue: string) => {
    const field = fields.find(f => f.value === fieldValue);
    return field?.options || [];
  };

  // Importar filtros
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importFilters(file);
      showToast({ type: 'success', message: 'Filtros importados com sucesso!' });
    } catch (error) {
      showToast({ type: 'error', message: 'Erro ao importar filtros' });
    }

    // Limpar input
    e.target.value = '';
  };

  return (
    <>
      {/* Botão para abrir */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${getPrimaryButtonClass(primaryColor)}`}
        title="Filtros Avançados"
      >
        <Icons.Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filtros</span>
        {conditions.length > 0 && (
          <span className="ml-1 px-2 py-0.5 bg-white dark:bg-slate-700 rounded-full text-xs font-bold">
            {conditions.length}
          </span>
        )}
      </button>

      {/* Modal de filtros */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Filtros Avançados"
        size="xl"
      >
        <div className="flex flex-col h-[600px]">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-4">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'current'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              Filtro Atual
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'saved'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              Salvos ({savedFilters.length})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'favorites'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Icons.Star className="w-4 h-4 inline mr-1" />
              Favoritos ({favoriteFilters.length})
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'recent'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Icons.Clock className="w-4 h-4 inline mr-1" />
              Recentes
            </button>
          </div>

          {/* Conteúdo das tabs */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'current' && (
              <div className="space-y-4">
                {/* Lista de condições */}
                {conditions.map((condition, index) => {
                  const field = fields.find(f => f.value === condition.field);
                  const operators = getOperatorsForField(condition.field);
                  const options = getFieldOptions(condition.field);

                  return (
                    <div
                      key={index}
                      className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                    >
                      {/* Campo */}
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(index, { field: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                      >
                        {fields.map(f => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      {/* Operador */}
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                      >
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      {/* Valor */}
                      {field?.type === 'select' ? (
                        <select
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                        >
                          <option value="">Selecione...</option>
                          {options.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : field?.type === 'boolean' ? (
                        <select
                          value={String(condition.value)}
                          onChange={(e) => updateCondition(index, { value: e.target.value === 'true' })}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                        >
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      ) : (
                        <input
                          type={field?.type === 'date' ? 'date' : field?.type === 'number' ? 'number' : 'text'}
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                          placeholder="Valor..."
                        />
                      )}

                      {/* Remover */}
                      <button
                        onClick={() => removeCondition(index)}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remover condição"
                      >
                        <Icons.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Adicionar condição */}
                <button
                  onClick={addCondition}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
                >
                  <Icons.Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Adicionar Condição</span>
                </button>

                {conditions.length > 0 && (
                  <button
                    onClick={() => setSaveModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Icons.Save className="w-4 h-4" />
                    Salvar este filtro
                  </button>
                )}
              </div>
            )}

            {(activeTab === 'saved' || activeTab === 'favorites' || activeTab === 'recent') && (
              <div className="space-y-2">
                {/* Ações de exportar/importar */}
                {activeTab === 'saved' && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={exportFilters}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Icons.Download className="w-4 h-4" />
                      Exportar
                    </button>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                      <Icons.Upload className="w-4 h-4" />
                      Importar
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Lista de filtros */}
                {(activeTab === 'saved' ? savedFilters : activeTab === 'favorites' ? favoriteFilters : recentFilters).map(filter => (
                  <div
                    key={filter.id}
                    className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-slate-100">
                            {filter.name}
                          </h4>
                          {filter.favorite && (
                            <Icons.Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        {filter.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {filter.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-slate-400">
                          <span>{filter.conditions.length} condições</span>
                          {filter.useCount > 0 && (
                            <span>Usado {filter.useCount}x</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFavorite(filter.id)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                          title={filter.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Icons.Star className={`w-4 h-4 ${filter.favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                        </button>
                        <button
                          onClick={() => loadSavedFilter(filter)}
                          className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${getThemeClasses(primaryColor, 'text')}`}
                          title="Carregar filtro"
                        >
                          <Icons.Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => duplicateFilter(filter.id)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-slate-400"
                          title="Duplicar"
                        >
                          <Icons.Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Deseja excluir este filtro?')) {
                              deleteFilter(filter.id);
                              showToast({ type: 'success', message: 'Filtro excluído' });
                            }
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-red-600 dark:text-red-400"
                          title="Excluir"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {(activeTab === 'saved' ? savedFilters : activeTab === 'favorites' ? favoriteFilters : recentFilters).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    <p className="text-sm">
                      {activeTab === 'saved' && 'Nenhum filtro salvo ainda'}
                      {activeTab === 'favorites' && 'Nenhum filtro favoritado'}
                      {activeTab === 'recent' && 'Nenhum filtro usado recentemente'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-slate-700 mt-4">
            <button
              onClick={handleClear}
              disabled={conditions.length === 0}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Limpar Tudo
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${getPrimaryButtonClass(primaryColor)}`}
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal para salvar filtro */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Salvar Filtro"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Nome do filtro *
            </label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Ex: Animais nascidos em 2025"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-slate-100"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Descrição (opcional)
            </label>
            <textarea
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              placeholder="Adicione uma descrição..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-slate-100 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setSaveModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveFilter}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${getPrimaryButtonClass(primaryColor)}`}
            >
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
});

export default AdvancedFilters;
