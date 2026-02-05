import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import { useBalancaStore } from '../stores/balancaStore';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings';
import { useAlertSettings, AlertSettings } from '../hooks/useAlertSettings';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import { COLOR_PALETTES, ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryButtonClass } from '../utils/themeHelpers';
import { showToast } from '../utils/toast';
import AutoBackupManager from '../components/AutoBackupManager';
import TagsManager from '../components/TagsManager';
import { exportarBackupCompleto, importarBackup } from '../utils/exportarDados';
import Input from '../components/Input';
import ModalRaca from '../components/ModalRaca';
import ModalCategoria from '../components/ModalCategoria';

export default function Configuracoes() {
  const { draftSettings: draftAppSettings, setDraftSettings: setDraftAppSettings, saveSettings: saveAppSettings, resetSettings: resetAppSettings } = useAppSettings();
  const { draftSettings, setDraftSettings, saveSettings, resetSettings } = useAlertSettings();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const podeExportarDados = hasPermission('exportar_dados');
  const podeGerenciarRacas = hasPermission('gerenciar_racas');
  const podeGerenciarCategorias = hasPermission('gerenciar_categorias');
  const [activeTab, setActiveTab] = useState<'alertas' | 'sincronizacao' | 'aparencia' | 'backup' | 'tags' | 'app' | 'balanca' | 'racas_categorias'>('alertas');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [balancaConectada, setBalancaConectada] = useState(false);
  const [pesoAtualBalança, setPesoAtualBalança] = useState<number | null>(null);
  const [balancaErro, setBalancaErro] = useState<string | null>(null);
  const [modalRacaOpen, setModalRacaOpen] = useState(false);
  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false);
  const primaryColor = (draftAppSettings?.primaryColor || 'gray') as ColorPaletteKey;

  const handleExportBackup = async () => {
    if (!podeExportarDados) {
      showToast({ type: 'error', title: 'Sem permissão', message: 'Você não tem permissão para exportar dados.' });
      return;
    }
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
    { id: 'tags' as const, label: 'Tags', icon: Icons.Tag },
    { id: 'app' as const, label: 'App (PWA)', icon: Icons.Monitor },
    { id: 'balanca' as const, label: 'Balança', icon: Icons.Scale },
    { id: 'racas_categorias' as const, label: 'Raças e Categorias', icon: Icons.Tag }
  ];

  const racas = useLiveQuery(() => db.racas.toArray(), [activeTab === 'racas_categorias']) ?? [];
  const categorias = useLiveQuery(() => db.categorias.toArray(), [activeTab === 'racas_categorias']) ?? [];

  const handleConectarBalança = async () => {
    setBalancaErro(null);
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      setBalancaErro('Bluetooth não disponível neste navegador. Use Chrome/Edge em HTTPS.');
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [0x181D] }],
        optionalServices: [0x181D, 'weight_scale', '0000181d-0000-1000-8000-00805f9b34fb']
      });
      const server = await device.gatt?.connect();
      if (!server) {
        setBalancaErro('Não foi possível conectar ao GATT.');
        return;
      }
      const service = await server.getPrimaryService(0x181D);
      const char = await service.getCharacteristic(0x2A9D);
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target?.value;
        if (value && value.byteLength >= 3) {
          const flags = value.getUint8(0);
          const unit = (flags & 1) === 0 ? 1 : 0.453592; // SI kg ou lb->kg
          const peso = value.getUint16(1, true) / 200 * unit;
          const pesoRounded = Math.round(peso * 100) / 100;
          setPesoAtualBalança(pesoRounded);
          useBalancaStore.getState().setPesoKg(pesoRounded);
        }
      });
      setBalancaConectada(true);
      showToast({ type: 'success', title: 'Balança conectada', message: 'Coloque o animal na balança para ler o peso.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar. Verifique se a balança está ligada e pareada.';
      setBalancaErro(msg);
      showToast({ type: 'error', title: 'Balança', message: msg });
    }
  };

  const handleDesconectarBalança = () => {
    setBalancaConectada(false);
    setPesoAtualBalança(null);
    setBalancaErro(null);
    useBalancaStore.getState().setPesoKg(null);
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      showToast({ type: 'warning', title: 'Não suportado', message: 'Notificações não estão disponíveis neste navegador.' });
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        const subscription = await subscribePush();
        if (subscription && user?.id) {
          const payload = subscriptionToPayload(subscription);
          const { error } = await supabase.from('push_subscriptions').upsert(
            { user_id: user.id, endpoint: payload.endpoint, p256dh: payload.p256dh, auth: payload.auth },
            { onConflict: 'endpoint' }
          );
          if (error) {
            console.warn('Erro ao salvar subscription de push:', error);
            showToast({ type: 'success', title: 'Notificações ativadas', message: 'Para receber alertas push, o servidor precisa estar configurado para envio.' });
          } else {
            showToast({ type: 'success', title: 'Notificações ativadas', message: 'Este dispositivo foi registrado para receber alertas push.' });
          }
        } else {
          showToast({ type: 'success', title: 'Notificações ativadas', message: 'Para receber alertas push, configure VITE_VAPID_PUBLIC_KEY e o servidor de envio.' });
        }
      } else if (perm === 'denied') {
        showToast({ type: 'info', title: 'Notificações negadas', message: 'Você pode ativar depois nas configurações do navegador.' });
      }
    } catch (e) {
      showToast({ type: 'error', title: 'Erro', message: 'Não foi possível solicitar permissão.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-2 sm:p-4 md:p-6 lg:p-8 max-w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto w-full">
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
                  <Input
                    label="Desmama após (meses)"
                    type="number"
                    min={1}
                    max={36}
                    value={String(draftSettings.limiteMesesDesmama)}
                    onChange={(e) =>
                      setDraftSettings((prev: AlertSettings) => ({
                        ...prev,
                        limiteMesesDesmama: Number(e.target.value)
                      }))
                    }
                  />

                  <Input
                    label="Janela de mortalidade (meses)"
                    type="number"
                    min={1}
                    max={24}
                    value={String(draftSettings.janelaMesesMortalidade)}
                    onChange={(e) =>
                      setDraftSettings((prev: AlertSettings) => ({
                        ...prev,
                        janelaMesesMortalidade: Number(e.target.value)
                      }))
                    }
                  />

                  <Input
                    label="Taxa de mortalidade alarmante (%)"
                    type="number"
                    min={1}
                    max={100}
                    value={String(draftSettings.limiarMortalidade)}
                    onChange={(e) =>
                      setDraftSettings((prev: AlertSettings) => ({
                        ...prev,
                        limiarMortalidade: Number(e.target.value)
                      }))
                    }
                  />
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
                  <Input
                    label="Intervalo de sincronização (segundos)"
                    type="number"
                    min={10}
                    max={300}
                    value={String(draftAppSettings?.intervaloSincronizacao ?? 30)}
                    onChange={(e) => {
                      if (setDraftAppSettings) {
                        setDraftAppSettings((prev: AppSettings) => ({
                          ...prev,
                          intervaloSincronizacao: Number(e.target.value)
                        }));
                      }
                    }}
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
                  <Input
                    label="Timeout de Inatividade (minutos)"
                    type="number"
                    min={1}
                    max={120}
                    value={String(draftAppSettings?.timeoutInatividade ?? 15)}
                    onChange={(e) => {
                      if (setDraftAppSettings) {
                        setDraftAppSettings((prev: AppSettings) => ({
                          ...prev,
                          timeoutInatividade: Number(e.target.value)
                        }));
                      }
                    }}
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
                    {podeExportarDados && (
                    <button
                      onClick={handleExportBackup}
                      title="Exportar Backup Completo"
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white ${getPrimaryButtonClass(primaryColor)} rounded-lg hover:shadow-lg transition-all`}
                    >
                      <Icons.Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Exportar Backup Completo</span>
                    </button>
                    )}
                    <button
                      onClick={handleImportBackup}
                      title="Importar Backup"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 hover:shadow-md transition-all"
                    >
                      <Icons.Upload className="w-4 h-4" />
                      <span className="hidden sm:inline">Importar Backup</span>
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

            {/* App (PWA) - item 16 Sprint 5 */}
            {activeTab === 'app' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Recursos do App (PWA)</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                    Ative as opções desejadas e clique em <strong>Salvar</strong> no final da página.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Notificações no navegador</h4>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!draftAppSettings?.allowBrowserNotifications}
                      onChange={(e) =>
                        setDraftAppSettings?.((prev: AppSettings) => ({
                          ...prev,
                          allowBrowserNotifications: e.target.checked
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Permitir notificações no navegador</span>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        O app poderá exibir notificações (alertas, lembretes). Marque e salve; se o navegador pedir permissão, aceite. Para push com app fechado, é necessário configurar o servidor.
                      </p>
                    </div>
                  </label>
                  <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      Status do navegador: <strong>{notificationPermission === 'granted' ? 'Permitido' : notificationPermission === 'denied' ? 'Negado' : 'Não definido'}</strong>
                    </span>
                    {notificationPermission !== 'granted' && (
                      <button
                        type="button"
                        onClick={handleRequestNotificationPermission}
                        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        Pedir permissão agora
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Modo Campo / Curral (v0.4)</h4>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!draftAppSettings?.modoCurral}
                      onChange={(e) =>
                        setDraftAppSettings?.((prev: AppSettings) => ({
                          ...prev,
                          modoCurral: e.target.checked
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Usar modo Curral no app</span>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        Fonte maior, alto contraste e botões mais altos para uso no curral (sol, luvas). Ative e salve; o layout será aplicado em todo o app.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Sincronização em segundo plano</h4>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Com o app aberto, quando a conexão voltar, os dados pendentes são sincronizados automaticamente. Use a tela Sincronização para ver pendências e forçar envio.
                  </p>
                </div>
              </div>
            )}

            {/* Raças e Categorias */}
            {activeTab === 'racas_categorias' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Raças e Categorias</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                    Cadastre raças e categorias usadas no sistema. Raças aparecem no cadastro de animais; categorias podem ser usadas em tipos e classificações.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Raças</h4>
                      {podeGerenciarRacas && (
                        <button
                          type="button"
                          onClick={() => setModalRacaOpen(true)}
                          className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg ${getPrimaryButtonClass(primaryColor)}`}
                        >
                          Nova raça
                        </button>
                      )}
                    </div>
                    <ul className="text-sm text-gray-700 dark:text-slate-300 space-y-1 max-h-48 overflow-y-auto">
                      {racas.length === 0 ? (
                        <li className="text-gray-500 dark:text-slate-400">Nenhuma raça cadastrada.</li>
                      ) : (
                        racas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map((r) => (
                          <li key={r.id}>{r.nome}</li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Categorias</h4>
                      {podeGerenciarCategorias && (
                        <button
                          type="button"
                          onClick={() => setModalCategoriaOpen(true)}
                          className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg ${getPrimaryButtonClass(primaryColor)}`}
                        >
                          Nova categoria
                        </button>
                      )}
                    </div>
                    <ul className="text-sm text-gray-700 dark:text-slate-300 space-y-1 max-h-48 overflow-y-auto">
                      {categorias.length === 0 ? (
                        <li className="text-gray-500 dark:text-slate-400">Nenhuma categoria cadastrada.</li>
                      ) : (
                        categorias.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map((c) => (
                          <li key={c.id}>{c.nome}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
                {modalRacaOpen && (
                  <ModalRaca
                    open={modalRacaOpen}
                    onClose={() => setModalRacaOpen(false)}
                    onRacaCadastrada={() => setModalRacaOpen(false)}
                  />
                )}
                {modalCategoriaOpen && (
                  <ModalCategoria
                    open={modalCategoriaOpen}
                    onClose={() => setModalCategoriaOpen(false)}
                    onCategoriaCadastrada={() => setModalCategoriaOpen(false)}
                  />
                )}
              </div>
            )}

            {/* Balança - item 14 Sprint 5 (Web Bluetooth) */}
            {activeTab === 'balanca' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Integração com Balança</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                    Conecte uma balança Bluetooth (perfil Weight Scale) para ler o peso. Funciona em Chrome/Edge em HTTPS.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
                  {balancaErro && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                      {balancaErro}
                    </div>
                  )}
                  {!balancaConectada ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <Icons.Scale className="w-12 h-12 text-gray-400 dark:text-slate-500 shrink-0" />
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          Toque em &quot;Conectar balança&quot; e selecione o dispositivo no navegador. Balanças que seguem o perfil Bluetooth Weight Scale (0x181D) são compatíveis.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConectarBalança}
                        className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${getPrimaryButtonClass(primaryColor)}`}
                      >
                        Conectar balança
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <Icons.Scale className="w-10 h-10 text-green-600 dark:text-green-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Balança conectada</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                              {pesoAtualBalança != null ? `${pesoAtualBalança} kg` : '—'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDesconectarBalança}
                          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                        >
                          Desconectar
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Coloque o animal na balança para atualizar o peso. Use a tela de Pesagem para registrar o valor no animal.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer com botões de ação */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleResetAll}
            title="Restaurar Padrões"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all"
          >
            <Icons.RotateCcw className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Restaurar Padrões</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            title="Salvar Alterações"
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white ${getPrimaryButtonClass(primaryColor)} rounded-lg hover:shadow-lg transform hover:scale-105 transition-all`}
          >
            <Icons.Check className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Salvar Alterações</span>
          </button>
        </div>
      </div>
    </div>
  );
}
