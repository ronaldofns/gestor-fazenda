import { memo, useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { useTags, Tag } from '../hooks/useTags';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses } from '../utils/themeHelpers';
import Modal from './Modal';
import { showToast } from '../utils/toast';

interface TagsManagerProps {
  buttonLabel?: string;
  compactMode?: boolean;
}

const TagsManager = memo(function TagsManager({ 
  buttonLabel = 'Gerenciar Tags',
  compactMode = false
}: TagsManagerProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  
  const {
    tags,
    createTag,
    updateTag,
    deleteTag,
    popularTags,
    tagsByCategory,
    searchTags,
    exportTags,
    importTags,
    clearAll,
    stats
  } = useTags();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'categories'>('all');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const DEFAULT_COLORS = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#6b7280', '#14b8a6', '#f97316', '#06b6d4'
  ];

  const filteredTags = searchQuery ? searchTags(searchQuery) : tags;

  const handleSaveTag = () => {
    if (!formName.trim()) {
      showToast({ type: 'error', message: 'Digite um nome para a tag' });
      return;
    }

    if (editingTag) {
      updateTag(editingTag.id, {
        name: formName,
        color: formColor,
        category: formCategory || undefined,
        description: formDescription || undefined
      });
      showToast({ type: 'success', message: 'Tag atualizada!' });
    } else {
      createTag(formName, formColor, formCategory || undefined, formDescription || undefined);
      showToast({ type: 'success', message: 'Tag criada com sucesso!' });
    }

    resetForm();
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormCategory(tag.category || '');
    setFormDescription(tag.description || '');
    setShowForm(true);
  };

  const handleDeleteTag = (tag: Tag) => {
    if (window.confirm(`Deseja excluir a tag "${tag.name}"?`)) {
      deleteTag(tag.id);
      showToast({ type: 'success', message: 'Tag excluída' });
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormColor('#3b82f6');
    setFormCategory('');
    setFormDescription('');
    setEditingTag(null);
    setShowForm(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importTags(file);
      showToast({ type: 'success', message: 'Tags importadas com sucesso!' });
    } catch (error) {
      showToast({ type: 'error', message: 'Erro ao importar tags' });
    }

    e.target.value = '';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={compactMode
          ? `p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors`
          : `flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors`
        }
        title="Gerenciar Tags"
      >
        <Icons.Tag className="w-4 h-4" />
        {!compactMode && <span className="text-sm font-medium">{buttonLabel}</span>}
        {tags.length > 0 && !compactMode && (
          <span className="ml-1 px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded-full text-xs font-bold">
            {tags.length}
          </span>
        )}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          resetForm();
        }}
        title="Gerenciador de Tags"
        size="xl"
      >
        <div className="space-y-4">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalTags}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">Total de Tags</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.totalAssignments}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">Atribuições</div>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.categories}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">Categorias</div>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.totalUsage}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">Usos Totais</div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${getPrimaryButtonClass(primaryColor)}`}
            >
              <Icons.Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Nova Tag</span>
            </button>

            <button
              onClick={exportTags}
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

            {tags.length > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Icons.Trash className="w-4 h-4" />
                Limpar Tudo
              </button>
            )}
          </div>

          {/* Formulário */}
          {showForm && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-slate-100">
                {editingTag ? 'Editar Tag' : 'Nova Tag'}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Urgente"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Ex: Status"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Cor
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer border border-gray-300 dark:border-slate-600"
                  />
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-6 h-6 rounded border-2 ${formColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Adicione uma descrição..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTag}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${getPrimaryButtonClass(primaryColor)}`}
                >
                  {editingTag ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          )}

          {/* Busca */}
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tags..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'all'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400'
              }`}
            >
              Todas ({filteredTags.length})
            </button>
            <button
              onClick={() => setActiveTab('popular')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'popular'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400'
              }`}
            >
              Populares
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === 'categories'
                  ? `${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'bg-light')} border-b-2 ${getThemeClasses(primaryColor, 'border')}`
                  : 'text-gray-600 dark:text-slate-400'
              }`}
            >
              Por Categoria
            </button>
          </div>

          {/* Lista de Tags */}
          <div className="max-h-96 overflow-y-auto">
            {activeTab === 'all' && (
              <div className="space-y-2">
                {filteredTags.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    <Icons.Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma tag encontrada</p>
                  </div>
                ) : (
                  filteredTags.map(tag => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-slate-100 truncate">
                            {tag.name}
                          </span>
                          {tag.category && (
                            <span className="text-xs text-gray-500 dark:text-slate-400 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">
                              {tag.category}
                            </span>
                          )}
                        </div>
                        {tag.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">
                            {tag.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                          <span>Usada {tag.usageCount}x</span>
                          <span>•</span>
                          <span>{new Date(tag.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditTag(tag)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-blue-600 dark:text-blue-400"
                          title="Editar"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-red-600 dark:text-red-400"
                          title="Excluir"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'popular' && (
              <div className="space-y-2">
                {popularTags.map((tag, index) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 font-medium text-gray-900 dark:text-slate-100">
                      {tag.name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      {tag.usageCount} usos
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="space-y-4">
                {Array.from(tagsByCategory.entries()).map(([category, categoryTags]) => (
                  <div key={category}>
                    <h5 className="font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {category} ({categoryTags.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {categoryTags.map(tag => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700"
                          style={{ borderLeftWidth: '4px', borderLeftColor: tag.color }}
                        >
                          <span className="text-sm text-gray-900 dark:text-slate-100">
                            {tag.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            {tag.usageCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
});

export default TagsManager;
