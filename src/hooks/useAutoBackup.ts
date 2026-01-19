import { useState, useEffect, useCallback } from 'react';
import { exportarBackupCompleto } from '../utils/exportarDados';
import { showToast } from '../utils/toast';

/**
 * Sistema de backup automático agendado
 * Salva automaticamente o backup em intervalos configuráveis
 */

export interface BackupHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  size: number;
  success: boolean;
  error?: string;
  metadata?: {
    totalNascimentos: number;
    totalDesmamas: number;
    totalPesagens: number;
    totalVacinacoes: number;
    totalMatrizes: number;
    totalFazendas: number;
  };
}

export interface AutoBackupSettings {
  enabled: boolean;
  intervalMinutes: number;
  maxHistoryItems: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  autoDownload: boolean; // Auto download ou apenas salvar no IndexedDB
}

const SETTINGS_KEY = 'gf-auto-backup-settings';
const HISTORY_KEY = 'gf-backup-history';
const DEFAULT_SETTINGS: AutoBackupSettings = {
  enabled: false,
  intervalMinutes: 1440, // 24 horas por padrão
  maxHistoryItems: 10,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  autoDownload: false
};

export function useAutoBackup() {
  // Carregar configurações
  const [settings, setSettings] = useState<AutoBackupSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Erro ao carregar configurações de backup:', error);
      return DEFAULT_SETTINGS;
    }
  });

  // Carregar histórico
  const [history, setHistory] = useState<BackupHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar histórico de backup:', error);
      return [];
    }
  });

  const [isRunning, setIsRunning] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    const last = history[0];
    return last?.timestamp || null;
  });
  const [nextBackupAt, setNextBackupAt] = useState<string | null>(null);

  // Salvar configurações no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  }, [settings]);

  // Salvar histórico no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }, [history]);

  // Executar backup
  const executeBackup = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    const timestamp = new Date().toISOString();

    try {
      // Executar backup
      const result = await exportarBackupCompleto();

      // Criar entrada no histórico
      const historyItem: BackupHistoryItem = {
        id: crypto.randomUUID(),
        timestamp,
        fileName: `backup-${timestamp.split('T')[0]}.json`,
        size: new Blob([result]).size,
        success: true,
        metadata: {
          totalNascimentos: 0, // Será preenchido pelo exportarBackupCompleto
          totalDesmamas: 0,
          totalPesagens: 0,
          totalVacinacoes: 0,
          totalMatrizes: 0,
          totalFazendas: 0
        }
      };

      // Adicionar ao histórico (limitado ao máximo)
      setHistory(prev => {
        const updated = [historyItem, ...prev].slice(0, settings.maxHistoryItems);
        return updated;
      });

      setLastBackupAt(timestamp);

      // Notificar sucesso
      if (settings.notifyOnSuccess) {
        showToast({
          type: 'success',
          title: 'Backup Automático',
          message: 'Backup realizado com sucesso!'
        });
      }
    } catch (error) {
      console.error('Erro ao executar backup:', error);

      // Adicionar erro ao histórico
      const historyItem: BackupHistoryItem = {
        id: crypto.randomUUID(),
        timestamp,
        fileName: '',
        size: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };

      setHistory(prev => [historyItem, ...prev].slice(0, settings.maxHistoryItems));

      // Notificar falha
      if (settings.notifyOnFailure) {
        showToast({
          type: 'error',
          title: 'Erro no Backup Automático',
          message: 'Falha ao criar backup. Tente novamente.'
        });
      }
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, settings]);

  // Calcular próximo backup
  useEffect(() => {
    if (!settings.enabled || !lastBackupAt) {
      setNextBackupAt(null);
      return;
    }

    const lastDate = new Date(lastBackupAt);
    const nextDate = new Date(lastDate.getTime() + settings.intervalMinutes * 60 * 1000);
    setNextBackupAt(nextDate.toISOString());
  }, [settings.enabled, settings.intervalMinutes, lastBackupAt]);

  // Timer para backup automático
  useEffect(() => {
    if (!settings.enabled) return;

    const checkAndBackup = () => {
      if (!nextBackupAt) {
        // Primeiro backup
        executeBackup();
        return;
      }

      const now = new Date();
      const next = new Date(nextBackupAt);

      if (now >= next) {
        executeBackup();
      }
    };

    // Verificar a cada minuto
    const interval = setInterval(checkAndBackup, 60 * 1000);

    // Verificar imediatamente ao iniciar
    checkAndBackup();

    return () => clearInterval(interval);
  }, [settings.enabled, nextBackupAt, executeBackup]);

  // Atualizar configurações
  const updateSettings = useCallback((updates: Partial<AutoBackupSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Executar backup manual
  const runManualBackup = useCallback(async () => {
    await executeBackup();
  }, [executeBackup]);

  // Limpar histórico
  const clearHistory = useCallback(() => {
    if (window.confirm('Deseja limpar todo o histórico de backups?')) {
      setHistory([]);
      showToast({ type: 'info', message: 'Histórico de backups limpo' });
    }
  }, []);

  // Deletar item do histórico
  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  // Estatísticas
  const stats = {
    totalBackups: history.length,
    successfulBackups: history.filter(h => h.success).length,
    failedBackups: history.filter(h => !h.success).length,
    lastBackup: history[0] || null,
    averageSize:
      history.filter(h => h.success).reduce((acc, h) => acc + h.size, 0) /
      (history.filter(h => h.success).length || 1)
  };

  // Calcular tempo restante para próximo backup
  const getTimeUntilNextBackup = useCallback((): string => {
    if (!settings.enabled || !nextBackupAt) return 'Desabilitado';

    const now = new Date();
    const next = new Date(nextBackupAt);
    const diffMs = next.getTime() - now.getTime();

    if (diffMs <= 0) return 'Em execução...';

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMinutes % 60}m`;
    return `${diffMinutes}m`;
  }, [settings.enabled, nextBackupAt]);

  return {
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
  };
}
