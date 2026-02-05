import { memo, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icons } from '../utils/iconMapping';
import { db } from '../db/dexieDB';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses } from '../utils/themeHelpers';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { showToast } from '../utils/toast';
import { uuid } from '../utils/uuid';
import Input from './Input';
import Textarea from './Textarea';

interface TagsManagerProps {
  buttonLabel?: string;
  compactMode?: boolean;
  inline?: boolean;
}

const TagsManager = memo(function TagsManager({ 
  buttonLabel = 'Gerenciar Tags',
  compactMode = false,
  inline = false
}: TagsManagerProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const podeExportarDados = hasPermission('exportar_dados');
  
  // Carregar tags do Dexie
  const tags = useLiveQuery(
    () => db.tags.filter(t => !t.deletedAt).toArray(),
    []
  ) ?? [];

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'categories'>('all');
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Confirm Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const DEFAULT_COLORS = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#6b7280', '#14b8a6', '#f97316', '#06b6d4'
  ];

  // Stats calculadas
  const stats = useMemo(() => {
    const totalTags = tags.length;
    const totalUsage = tags.reduce((sum, t) => sum + t.usageCount, 0);
    const categories = new Set(tags.map(t => t.category).filter(Boolean)).size;
    return { totalTags, totalUsage, categories };
  }, [tags]);

  // Tags populares (top 10)
  const popularTags = useMemo(() => {
    return [...tags].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
  }, [tags]);

  // Tags por categoria
  const tagsByCategory = useMemo(() => {
    const map = new Map<string, any[]>();
    tags.forEach(tag => {
      const cat = tag.category || 'Sem categoria';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tag);
    });
    return map;
  }, [tags]);

  const filteredTags = searchQuery 
    ? tags.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tags;

  const handleSaveTag = async () => {
    if (!formName.trim()) {
      showToast({ type: 'error', title: 'Nome obrigatório', message: 'Digite um nome para a tag' });
      return;
    }

    if (!user) {
      showToast({ type: 'error', title: 'Erro', message: 'Usuário não autenticado' });
      return;
    }

    try {
      const now = new Date().toISOString();

      if (editingTag) {
        // Atualizar tag existente
        await db.tags.update(editingTag.id, {
          name: formName.trim(),
          color: formColor,
          category: formCategory.trim() || undefined,
          description: formDescription.trim() || undefined,
          updatedAt: now,
          synced: false
        });
        showToast({ type: 'success', title: 'Tag atualizada', message: formName });
      } else {
        // Criar nova tag
        const newTag = {
          id: uuid(),
          name: formName.trim(),
          color: formColor,
          category: formCategory.trim() || undefined,
          description: formDescription.trim() || undefined,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          usageCount: 0,
          synced: false,
          remoteId: null
        };

        await db.tags.add(newTag);
        showToast({ type: 'success', title: 'Tag criada', message: formName });
      }

      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar tag:', error);
      showToast({ 
        type: 'error', 
        title: 'Erro ao salvar', 
        message: error?.message || 'Tente novamente.' 
      });
    }
  };

  const handleEditTag = (tag: any) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormCategory(tag.category || '');
    setFormDescription(tag.description || '');
    setShowForm(true);
  };

  const handleDeleteTag = (tag: any) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir Tag',
      message: `Deseja excluir a tag "${tag.name}"?`,
      onConfirm: async () => {
        try {
          const now = new Date().toISOString();
          
          // Soft delete
          await db.tags.update(tag.id, {
            deletedAt: now,
            updatedAt: now,
            synced: false
          });
          
          // Soft delete de todas as atribuições
          const assignments = await db.tagAssignments
            .where('tagId')
            .equals(tag.id)
            .toArray();
          
          for (const assignment of assignments) {
            await db.tagAssignments.update(assignment.id, {
              deletedAt: now,
              updatedAt: now,
              synced: false
            });
          }
          
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
          showToast({ type: 'success', title: 'Tag excluída', message: tag.name });
        } catch (error: any) {
          console.error('Erro ao excluir tag:', error);
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
          showToast({ 
            type: 'error', 
            title: 'Erro ao excluir', 
            message: error?.message || 'Tente novamente.' 
          });
        }
      }
    });
  };

  const resetForm = () => {
    setFormName('');
    setFormColor('#3b82f6');
    setFormCategory('');
    setFormDescription('');
    setEditingTag(null);
    setShowForm(false);
  };

  const handleExport = async () => {
    if (!podeExportarDados) {
      showToast({ type: 'error', title: 'Sem permissão', message: 'Você não tem permissão para exportar dados.' });
      return;
    }
    try {
      const allTags = await db.tags.filter(t => !t.deletedAt).toArray();
      const exportData = {
        tags: allTags,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tags_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast({ type: 'success', title: 'Exportação concluída', message: `${allTags.length} tags exportadas` });
    } catch (error: any) {
      console.error('Erro ao exportar tags:', error);
      showToast({ type: 'error', title: 'Erro ao exportar', message: error?.message || 'Tente novamente.' });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        
        if (!imported.tags || !Array.isArray(imported.tags)) {
          throw new Error('Formato inválido');
        }

        if (!user) {
          showToast({ type: 'error', title: 'Erro', message: 'Usuário não autenticado' });
          return;
        }

        const now = new Date().toISOString();
        let importedCount = 0;

        for (const tag of imported.tags) {
          const existingTag = await db.tags.get(tag.id);
          
          if (!existingTag) {
            // Criar nova tag
            await db.tags.add({
              id: tag.id || uuid(),
              name: tag.name,
              color: tag.color || '#3b82f6',
              category: tag.category,
              description: tag.description,
              createdBy: user.id,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              usageCount: 0,
              synced: false,
              remoteId: null
            });
            importedCount++;
          }
        }

        showToast({ type: 'success', title: 'Importação concluída', message: `${importedCount} tags importadas` });
        event.target.value = '';
      } catch (error: any) {
        console.error('Erro ao importar:', error);
        showToast({ type: 'error', title: 'Erro ao importar', message: 'Verifique o arquivo e tente novamente.' });
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    setConfirmDialog({
      open: true,
      title: 'Limpar Todas as Tags',
      message: 'Deseja excluir TODAS as tags? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const now = new Date().toISOString();
          const allTags = await db.tags.filter(t => !t.deletedAt).toArray();
          
          for (const tag of allTags) {
            await db.tags.update(tag.id, {
              deletedAt: now,
              updatedAt: now,
              synced: false
            });
          }
          
          // Deletar todas as atribuições
          const allAssignments = await db.tagAssignments.filter(a => !a.deletedAt).toArray();
          for (const assignment of allAssignments) {
            await db.tagAssignments.update(assignment.id, {
              deletedAt: now,
              updatedAt: now,
              synced: false
            });
          }
          
          showToast({ type: 'success', title: 'Tags excluídas', message: `${allTags.length} tags removidas` });
        } catch (error: any) {
          console.error('Erro ao limpar tags:', error);
          showToast({ type: 'error', title: 'Erro ao limpar', message: error?.message || 'Tente novamente.' });
        } finally {
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  // Conteúdo reutilizável
  const content = (
    <div className="space-y-4">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalTags}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">Total de Tags</div>
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
              title="Nova Tag"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-lg transform hover:scale-105 ${getPrimaryButtonClass(primaryColor)}`}
            >
              <Icons.Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Tag</span>
            </button>

            {podeExportarDados && (
              <button
                onClick={handleExport}
                title="Exportar"
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all"
              >
                <Icons.Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}

            <label title="Importar" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all cursor-pointer">
              <Icons.Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>

            {tags.length > 0 && (
              <button
                onClick={handleClearAll}
                title="Limpar Tudo"
                className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:shadow-md transition-all"
              >
                <Icons.Trash className="w-4 h-4" />
                <span className="hidden sm:inline">Limpar Tudo</span>
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
                <Input
                  label="Nome"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Urgente"
                />

                <Input
                  label="Categoria"
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Ex: Status"
                />
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
                        type="button"
                        onClick={() => setFormColor(color)}
                        className={`w-6 h-6 rounded border-2 ${formColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Textarea
                label="Descrição"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Adicione uma descrição..."
                rows={2}
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTag}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-lg transform hover:scale-105 ${getPrimaryButtonClass(primaryColor)}`}
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
                    <p className="text-sm">
                      {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag criada ainda'}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={() => setShowForm(true)}
                        className={`mt-3 px-4 py-2 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-lg hover:shadow-md transition-all`}
                      >
                        Criar primeira tag
                      </button>
                    )}
                  </div>
                ) : (
                  filteredTags.map(tag => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-slate-100">
                              {tag.name}
                            </h4>
                            {tag.category && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded">
                                {tag.category}
                              </span>
                            )}
                          </div>
                          {tag.description && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                              {tag.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                            Usado {tag.usageCount}× {tag.synced ? '• Sincronizado' : '• Pendente'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditTag(tag)}
                          className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                          title="Editar"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
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
                {popularTags.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    <Icons.TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma tag foi usada ainda</p>
                  </div>
                ) : (
                  popularTags.map((tag, index) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700"
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-full font-bold text-gray-600 dark:text-slate-400">
                        #{index + 1}
                      </div>
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100">
                          {tag.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {tag.usageCount} uso{tag.usageCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="space-y-4">
                {Array.from(tagsByCategory.entries()).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    <Icons.Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma categoria definida</p>
                  </div>
                ) : (
                  Array.from(tagsByCategory.entries()).map(([category, categoryTags]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <Icons.Folder className="w-4 h-4" />
                        {category} ({categoryTags.length})
                      </h4>
                      <div className="ml-6 space-y-1">
                        {categoryTags.map((tag: any) => (
                          <div
                            key={tag.id}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800 rounded"
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-sm text-gray-900 dark:text-slate-100">
                              {tag.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-slate-400 ml-auto">
                              {tag.usageCount}×
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
    </div>
  );

  // Se inline, renderizar conteúdo diretamente (com ConfirmDialog)
  if (inline) {
    return (
      <>
        {content}
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant="danger"
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} })}
        />
      </>
    );
  }

  // Senão, renderizar botão com modal
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title={buttonLabel}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-lg ${getPrimaryButtonClass(primaryColor)}`}
      >
        <Icons.Tag className="w-4 h-4" />
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)}>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Gerenciar Tags
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {content}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} })}
      />
    </>
  );
});

export default TagsManager;
