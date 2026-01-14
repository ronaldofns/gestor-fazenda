import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/dexieDB';
import { AppSettingsDB } from '../db/models';
import { ColorPaletteKey } from './useThemeColors';

export interface AppSettings {
  timeoutInatividade: number; // Tempo de inatividade em minutos antes de fazer logout
  intervaloSincronizacao: number; // Intervalo de sincronização automática em segundos
  primaryColor: ColorPaletteKey; // Cor primária do tema
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  timeoutInatividade: 15, // 15 minutos padrão
  intervaloSincronizacao: 30, // 30 segundos padrão
  primaryColor: 'gray' // Cinza padrão
};

const EVENT_NAME = 'appSettingsUpdated';

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  return {
    timeoutInatividade: clampNumber(
      settings?.timeoutInatividade ?? DEFAULT_APP_SETTINGS.timeoutInatividade,
      1, // Mínimo 1 minuto
      120, // Máximo 120 minutos (2 horas)
      DEFAULT_APP_SETTINGS.timeoutInatividade
    ),
    intervaloSincronizacao: clampNumber(
      settings?.intervaloSincronizacao ?? DEFAULT_APP_SETTINGS.intervaloSincronizacao,
      10, // Mínimo 10 segundos
      300, // Máximo 300 segundos (5 minutos)
      DEFAULT_APP_SETTINGS.intervaloSincronizacao
    ),
    primaryColor: (settings?.primaryColor || DEFAULT_APP_SETTINGS.primaryColor) as ColorPaletteKey
  };
}

export function useAppSettings() {
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(() => {
    // Garantir que draftSettings sempre tenha todos os campos
    return { ...DEFAULT_APP_SETTINGS };
  });

  const applySettings = useCallback((settings: AppSettings) => {
    // Garantir que sempre tenha todos os campos com valores padrão
    const normalized = normalizeSettings(settings);
    setAppSettings(normalized);
    setDraftSettings({ ...normalized }); // Criar nova referência para evitar problemas
  }, []);

  const broadcastSettings = useCallback((settings: AppSettings) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<AppSettings>(EVENT_NAME, { detail: settings }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Carregar do IndexedDB primeiro (mais recente)
    const loadFromDB = async () => {
      try {
        const dbSettings = await db.appSettings.get('app-settings-global');
        if (dbSettings) {
          const settings = {
            timeoutInatividade: dbSettings.timeoutInatividade,
            intervaloSincronizacao: dbSettings.intervaloSincronizacao ?? DEFAULT_APP_SETTINGS.intervaloSincronizacao,
            primaryColor: dbSettings.primaryColor || DEFAULT_APP_SETTINGS.primaryColor
          };
          applySettings(normalizeSettings(settings));
          return;
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do app do IndexedDB:', err);
      }
      
      // Se não encontrou no IndexedDB, usar padrão
      applySettings(DEFAULT_APP_SETTINGS);
    };
    
    loadFromDB();
  }, [applySettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      try {
        const custom = event as CustomEvent<AppSettings>;
        if (custom.detail) {
          applySettings(normalizeSettings(custom.detail));
        }
      } catch (err) {
        console.error('Erro ao processar evento de configurações:', err);
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [applySettings]);

  const saveSettings = useCallback(async () => {
    const normalized = normalizeSettings(draftSettings);
    applySettings(normalized);
    
    // Salvar no IndexedDB para sincronização
    try {
      const now = new Date().toISOString();
      const existing = await db.appSettings.get('app-settings-global');
      
      if (existing) {
        await db.appSettings.update('app-settings-global', {
          timeoutInatividade: normalized.timeoutInatividade,
          intervaloSincronizacao: normalized.intervaloSincronizacao,
          primaryColor: normalized.primaryColor,
          updatedAt: now,
          synced: false // Marcar como não sincronizado para fazer push
        });
      } else {
        await db.appSettings.add({
          id: 'app-settings-global',
          timeoutInatividade: normalized.timeoutInatividade,
          intervaloSincronizacao: normalized.intervaloSincronizacao,
          primaryColor: normalized.primaryColor,
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null
        });
      }
    } catch (err) {
      console.error('Erro ao salvar configurações do app no IndexedDB:', err);
    }
    
    broadcastSettings(normalized);
    return normalized;
  }, [applySettings, broadcastSettings, draftSettings]);

  const resetSettings = useCallback(async () => {
    applySettings(DEFAULT_APP_SETTINGS);
    
    // Atualizar no IndexedDB para sincronização
    try {
      const now = new Date().toISOString();
      const existing = await db.appSettings.get('app-settings-global');
      
      if (existing) {
        await db.appSettings.update('app-settings-global', {
          timeoutInatividade: DEFAULT_APP_SETTINGS.timeoutInatividade,
          intervaloSincronizacao: DEFAULT_APP_SETTINGS.intervaloSincronizacao,
          primaryColor: DEFAULT_APP_SETTINGS.primaryColor,
          updatedAt: now,
          synced: false // Marcar como não sincronizado para fazer push
        });
      } else {
        await db.appSettings.add({
          id: 'app-settings-global',
          timeoutInatividade: DEFAULT_APP_SETTINGS.timeoutInatividade,
          intervaloSincronizacao: DEFAULT_APP_SETTINGS.intervaloSincronizacao,
          primaryColor: DEFAULT_APP_SETTINGS.primaryColor,
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null
        });
      }
    } catch (err) {
      console.error('Erro ao resetar configurações do app no IndexedDB:', err);
    }
    
    broadcastSettings(DEFAULT_APP_SETTINGS);
    return DEFAULT_APP_SETTINGS;
  }, [applySettings, broadcastSettings]);

  return {
    appSettings,
    draftSettings,
    setDraftSettings,
    saveSettings,
    resetSettings
  };
}
