import { useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings';
import { useAlertSettings, AlertSettings } from '../hooks/useAlertSettings';
import { COLOR_PALETTES, ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryButtonClass } from '../utils/themeHelpers';
import { showToast } from '../utils/toast';
import AutoBackupManager from '../components/AutoBackupManager';
import TagsManager from '../components/TagsManager';
import { exportarBackupCompleto, importarBackup } from '../utils/exportarDados';

export default function Configuracoes() {
  const { draftSettings: draftAppSettings, setDraftSettings: setDraftAppSettings, saveSettings: saveAppSettings, resetSettings: resetAppSettings } = useAppSettings();
  const { draftSettings, setDraftSettings, saveSettings, resetSettings } = useAlertSettings();
  const [activeTab, setActiveTab] = useState<'alertas' | 'sincronizacao' | 'aparencia' | 'backup' | 'tags'>('alertas');
  const primaryColor = (draftAppSettings?.primaryColor || 'gray') as ColorPaletteKey;

  const handleExportBackup = async () => {
    try {
      const backup = await exportarBackupCompleto();
      showToast({
        type: 'success',
        title: 'Backup exportado',
        message: `Backup completo: ${backup.totais.fazendas} fazendas, ${backup.totais.matrizes} matrizes, ${backup.totais.nascimentos} nascimentos, ${backup.totais.desmamas} desmamas, ${backup.totais.pesagens} pesagens, ${backup.totais.vacinacoes} vacinações, ${backup.totais.usuarios} usuários.`
      });
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      showToast({
        type: 'error',
        title: 'Erro ao exportar',
        message: 'Não foi possível exportar o backup.'
      });
    }
  };

  const handleImportBackup = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e: any) => {
      const arquivo = e.target?.files?.[0];
      if (!arquivo) return;

      try {
        const resultado = await importarBackup(arquivo);
        
        if (resultado.sucesso) {
          showToast({
            type: 'success',
            title: 'Backup importado',
            message: resultado.mensagem
          });
        } else {
          showToast({
            type: 'error',
            title: 'Erro na importação',
            message: resultado.mensagem
          });
        }
      } catch (error: any) {
        console.error('Erro ao importar backup:', error);
        showToast({
          type: 'error',
          title: 'Erro ao importar',
          message: error.message || 'Erro ao processar arquivo de backup.'
        });
      }
    };

    input.click();
  };

  const handleSaveAll = async () => {
    await saveSettings();
    await saveAppSettings();
    
    try {
      const { pushPending } = await import('../api/syncService');
      await pushPending();
      showToast({
        type: 'success',
        title: 'Configurações salvas',
        message: 'Todas as configurações foram atualizadas e sincronizadas.'
      });
    } catch (error) {
      console.error('Erro ao sincronizar configurações:', error);
      showToast({
        type: 'success',
        title: 'Configurações salvas',
        message: 'Configurações atualizadas. A sincronização será feita automaticamente.'
      });
    }
  };

  const handleResetAll = async () => {
    await resetSettings();
    await resetAppSettings();
    
    try {
      const { pushPending } = await import('../api/syncService');
      await pushPending();
      showToast({
        type: 'info',
        title: 'Configurações restauradas',
        message: 'Todas as configurações foram restauradas aos padrões e sincronizadas.'
      });
    } catch (error) {
      console.error('Erro ao sincronizar configurações:', error);
      showToast({
        type: 'info',
        title: 'Configurações restauradas',
        message: 'Configurações restauradas. A sincronização será feita automaticamente.'
      });
    }
  };

  const tabs = [
    { id: 'alertas' as const, label: 'Alertas', icon: Icons.Bell },
    { id: 'sincronizacao' as const, label: 'Sincronização', icon: Icons.RefreshCw },
    { id: 'aparencia' as const, label: 'Aparência', icon: Icons.Palette },
    { id: 'backup' as const, label: 'Backup', icon: Icons.Save },
    { id: 'tags' as const, label: 'Tags', icon: Icons.Tag }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-3">
            <Icons.Settings className="w-8 h-8" />
            Configurações
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
            Personalize alertas, sincronização, aparência, backup e tags do sistema
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 mb-6 overflow-hidden">
          <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-700">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? `border-${primaryColor}-600 ${getThemeClasses(primaryColor, 'text')} bg-${primaryColor}-50 dark:bg-${primaryColor}-900/20`
                    : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Alertas */}
            {activeTab === 'alertas' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Configurações de Alertas</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Defina limites e parâmetros para notificações</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Desmama após (meses)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={draftSettings.limiteMesesDesmama}
                      onChange={(e) =>
                        setDraftSettings((prev: AlertSettings) => ({
                          ...prev,
                          limiteMesesDesmama: Number(e.target.value)
                        }))
                      }
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Janela de mortalidade (meses)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={draftSettings.janelaMesesMortalidade}
                      onChange={(e) =>
                        setDraftSettings((prev: AlertSettings) => ({
                          ...prev,
                          janelaMesesMortalidade: Number(e.target.value)
                        }))
                      }
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Taxa de mortalidade alarmante (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={draftSettings.limiarMortalidade}
                      onChange={(e) =>
                        setDraftSettings((prev: AlertSettings) => ({
                          ...prev,
                          limiarMortalidade: Number(e.target.value)
                        }))
                      }
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sincronização */}
            {activeTab === 'sincronizacao' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Sincronização Automática</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Configure o intervalo de sincronização com o servidor</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Intervalo de sincronização (segundos)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={draftAppSettings?.intervaloSincronizacao ?? 30}
                    onChange={(e) => {
                      if (setDraftAppSettings) {
                        setDraftAppSettings((prev: AppSettings) => ({
                          ...prev,
                          intervaloSincronizacao: Number(e.target.value)
                        }));
                      }
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                    <Icons.Info className="w-3.5 h-3.5" />
                    O sistema sincronizará automaticamente a cada {draftAppSettings?.intervaloSincronizacao ?? 30} segundos quando estiver online.
                  </p>
                </div>
              </div>
            )}

            {/* Aparência */}
            {activeTab === 'aparencia' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Personalização da Interface</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Escolha a cor principal e timeout de inatividade</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                    Cor Principal do Sistema
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {COLOR_PALETTES && Object.entries(COLOR_PALETTES).map(([key, palette]) => {
                      const isSelected = ((draftAppSettings?.primaryColor) || 'gray') === key;
                      const colorMap: Record<string, string> = {
                        green: '#10b981',
                        blue: '#3b82f6',
                        emerald: '#10b981',
                        teal: '#14b8a6',
                        indigo: '#6366f1',
                        purple: '#a855f7',
                        gray: '#6b7280'
                      };

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (setDraftAppSettings) {
                              setDraftAppSettings((prev: AppSettings) => ({
                                ...prev,
                                primaryColor: key as ColorPaletteKey
                              }));
                            }
                          }}
                          className={`relative w-14 h-14 rounded-full border-4 transition-all transform hover:scale-110 ${
                            isSelected
                              ? 'border-gray-900 dark:border-slate-100 shadow-xl scale-110'
                              : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 hover:shadow-lg'
                          }`}
                          style={{ backgroundColor: colorMap[key] }}
                          title={palette.name}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Icons.Check className="w-6 h-6 text-white drop-shadow-lg" />
                            </div>
                          )}
                          <span className="sr-only">{palette.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
                    Cor selecionada: <strong>{COLOR_PALETTES[draftAppSettings?.primaryColor || 'gray']?.name || 'Cinza'}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Timeout de Inatividade (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={draftAppSettings?.timeoutInatividade ?? 15}
                    onChange={(e) => {
                      if (setDraftAppSettings) {
                        setDraftAppSettings((prev: AppSettings) => ({
                          ...prev,
                          timeoutInatividade: Number(e.target.value)
                        }));
                      }
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                    <Icons.Info className="w-3.5 h-3.5" />
                    Logout automático após {draftAppSettings?.timeoutInatividade ?? 15} minutos de inatividade.
                  </p>
                </div>
              </div>
            )}

            {/* Backup */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Gerenciamento de Backup</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Exporte, importe dados e configure backup automático</p>
                </div>

                {/* Backup Manual */}
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Icons.Download className="w-5 h-5" />
                    Backup Manual
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    Exporte todos os dados do sistema ou importe um backup anterior
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleExportBackup}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white ${getPrimaryButtonClass(primaryColor)} rounded-lg hover:shadow-lg transition-all`}
                    >
                      <Icons.Download className="w-4 h-4" />
                      Exportar Backup Completo
                    </button>
                    <button
                      onClick={handleImportBackup}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 hover:shadow-md transition-all"
                    >
                      <Icons.Upload className="w-4 h-4" />
                      Importar Backup
                    </button>
                  </div>
                </div>

                {/* Backup Automático */}
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Icons.Clock className="w-5 h-5" />
                    Backup Automático Agendado
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    Configure backups automáticos em intervalos regulares
                  </p>
                  <AutoBackupManager inline />
                </div>
              </div>
            )}

            {/* Tags */}
            {activeTab === 'tags' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Gerenciamento de Tags</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                    Crie e gerencie etiquetas personalizadas para organizar nascimentos, matrizes e fazendas
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Icons.Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">O que são Tags?</h4>
                      <p className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                        Tags são etiquetas coloridas que você pode criar e atribuir a animais, matrizes e fazendas para organizá-los. 
                        Exemplos: "Lote A 2025", "Para Venda", "Tratamento Especial", "Reprodutor Elite", etc.
                      </p>
                    </div>
                  </div>
                </div>

                <TagsManager inline />
              </div>
            )}
          </div>
        </div>

        {/* Footer com botões de ação */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleResetAll}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all"
          >
            <Icons.RotateCcw className="w-4 h-4 inline mr-2" />
            Restaurar Padrões
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className={`px-6 py-2.5 text-sm font-semibold text-white ${getPrimaryButtonClass(primaryColor)} rounded-lg hover:shadow-lg transform hover:scale-105 transition-all`}
          >
            <Icons.Check className="w-4 h-4 inline mr-2" />
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
