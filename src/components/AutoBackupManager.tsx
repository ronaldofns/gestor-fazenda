import { memo, useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { useAutoBackup } from '../hooks/useAutoBackup';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses, getPrimaryBadgeClass } from '../utils/themeHelpers';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import Combobox from './Combobox';
import { showToast } from '../utils/toast';

interface AutoBackupManagerProps {
  inline?: boolean;
}

const AutoBackupManager = memo(function AutoBackupManager({ inline = false }: AutoBackupManagerProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  
  const {
    settings,
    updateSettings,
    history,
    isRunning,
    lastBackupAt,
    nextBackupAt,
    runManualBackup,
    clearHistory,
    deleteHistoryItem,
    stats,
    getTimeUntilNextBackup
  } = useAutoBackup();

  const [isOpen, setIsOpen] = useState(false);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const intervalOptions = [
    { value: 60, label: 'A cada 1 hora' },
    { value: 180, label: 'A cada 3 horas' },
    { value: 360, label: 'A cada 6 horas' },
    { value: 720, label: 'A cada 12 horas' },
    { value: 1440, label: 'Diariamente (24h)' },
    { value: 2880, label: 'A cada 2 dias' },
    { value: 10080, label: 'Semanalmente' }
  ];

  // Conteúdo reutilizável
  const content = (
    <div className="space-y-6">
          {/* Status e Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card de Status */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${getPrimaryBadgeClass(primaryColor)}`}>
                  <Icons.BarChart className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">Status</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">Estado:</span>
                  <span className={`text-sm font-medium ${
                    settings.enabled
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-slate-500'
                  }`}>
                    {settings.enabled ? 'Ativo' : 'Desabilitado'}
                  </span>
                </div>
                {settings.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Próximo em:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {getTimeUntilNextBackup()}
                      </span>
                    </div>
                    {lastBackupAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-slate-400">Último:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {formatDate(lastBackupAt)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Card de Estatísticas */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Icons.BarChart className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">Estatísticas</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">Total:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {stats.totalBackups}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">Sucesso:</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {stats.successfulBackups}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">Falhas:</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {stats.failedBackups}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Diretório de Salvamento */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <div className="flex items-start gap-3">
              <Icons.Folder className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Diretório de Salvamento
                </h4>
                <p className="text-xs text-blue-800 dark:text-blue-400">
                  Os backups são salvos automaticamente na pasta <strong>Downloads</strong> do seu dispositivo (computador, tablet ou celular) com o formato: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">backup_gestor_fazenda_YYYY-MM-DD.json</code>
                </p>
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Icons.Settings className="w-5 h-5" />
              Configurações
            </h3>

            <div className="space-y-4">
              {/* Habilitar/Desabilitar */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Backup Automático
                  </label>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Ativa backups periódicos automáticos
                  </p>
                </div>
                <button
                  onClick={() => updateSettings({ enabled: !settings.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${
                    settings.enabled 
                      ? `${getPrimaryButtonClass(primaryColor).replace('bg-', 'bg-').replace('hover:', '')} opacity-100` 
                      : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Intervalo */}
              <Combobox
                label="Frequência"
                value={intervalOptions.find(opt => opt.value === settings.intervalMinutes)}
                onChange={(option) => option && updateSettings({ intervalMinutes: option.value })}
                options={intervalOptions}
                getOptionLabel={(opt) => opt.label}
                getOptionValue={(opt) => opt.value.toString()}
                placeholder="Selecione a frequência"
                disabled={!settings.enabled}
              />

              {/* Notificações */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnSuccess}
                    onChange={(e) => updateSettings({ notifyOnSuccess: e.target.checked })}
                    disabled={!settings.enabled}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    Notificar em caso de sucesso
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnFailure}
                    onChange={(e) => updateSettings({ notifyOnFailure: e.target.checked })}
                    disabled={!settings.enabled}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    Notificar em caso de falha
                  </span>
                </label>
              </div>

              {/* Máximo de itens no histórico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Histórico máximo: {settings.maxHistoryItems} backups
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={settings.maxHistoryItems}
                  onChange={(e) => updateSettings({ maxHistoryItems: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const result = await runManualBackup();
                if (result?.filePath) {
                  showToast({
                    type: 'success',
                    title: 'Backup realizado',
                    message: `Arquivo salvo em: ${result.filePath}`
                  });
                }
              }}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-lg ${getPrimaryButtonClass(primaryColor)} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Criando Backup...</span>
                </>
              ) : (
                <>
                  <Icons.Play className="w-4 h-4" />
                  <span>Executar Backup Agora</span>
                </>
              )}
            </button>

            {history.length > 0 && (
              <button
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: 'Limpar Histórico',
                    message: 'Deseja limpar todo o histórico de backups?',
                    onConfirm: () => {
                      clearHistory();
                      setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
                    }
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all text-gray-700 dark:text-slate-300"
              >
                <Icons.Trash className="w-4 h-4" />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>

          {/* Histórico */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Icons.History className="w-5 h-5" />
                Histórico de Backups
              </h3>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {history.length} de {settings.maxHistoryItems} registros
              </span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <Icons.Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum backup realizado ainda</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      item.success
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {item.success ? (
                            <Icons.CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Icons.XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {formatDate(item.timestamp)}
                          </span>
                        </div>
                        {item.success ? (
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-slate-400">
                            <span>{formatFileSize(item.size)}</span>
                            {item.fileName && (
                              <span className="truncate">{item.fileName}</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {item.error || 'Erro desconhecido'}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => deleteHistoryItem(item.id)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400"
                        title="Remover do histórico"
                      >
                        <Icons.X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
  );

  // Modo inline - renderiza apenas o conteúdo
  if (inline) {
    return content;
  }

  // Modo padrão - botão + Modal
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-slate-300"
        title="Backup Automático"
      >
        <Icons.Save className="w-4 h-4" />
        <span className="text-sm font-medium">Backup Auto</span>
        {settings.enabled && (
          <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getPrimaryBadgeClass(primaryColor)} animate-pulse`} />
        )}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Backup Automático"
        size="xl"
      >
        {content}
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="warning"
        confirmText="Limpar"
        cancelText="Cancelar"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} })}
      />
    </>
  );
});

export default AutoBackupManager;
