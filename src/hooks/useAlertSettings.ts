import { useCallback, useEffect, useState } from 'react';

export interface AlertSettings {
  limiteMesesDesmama: number;
  janelaMesesMortalidade: number;
  limiarMortalidade: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  limiteMesesDesmama: 8,
  janelaMesesMortalidade: 6,
  limiarMortalidade: 10
};

const EVENT_NAME = 'alertSettingsUpdated';

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeSettings(settings?: Partial<AlertSettings>): AlertSettings {
  return {
    limiteMesesDesmama: clampNumber(
      settings?.limiteMesesDesmama ?? DEFAULT_ALERT_SETTINGS.limiteMesesDesmama,
      1,
      36,
      DEFAULT_ALERT_SETTINGS.limiteMesesDesmama
    ),
    janelaMesesMortalidade: clampNumber(
      settings?.janelaMesesMortalidade ?? DEFAULT_ALERT_SETTINGS.janelaMesesMortalidade,
      1,
      24,
      DEFAULT_ALERT_SETTINGS.janelaMesesMortalidade
    ),
    limiarMortalidade: clampNumber(
      settings?.limiarMortalidade ?? DEFAULT_ALERT_SETTINGS.limiarMortalidade,
      1,
      100,
      DEFAULT_ALERT_SETTINGS.limiarMortalidade
    )
  };
}

export function useAlertSettings() {
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);

  const applySettings = useCallback((settings: AlertSettings) => {
    setAlertSettings(settings);
    setDraftSettings(settings);
  }, []);

  const broadcastSettings = useCallback((settings: AlertSettings) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<AlertSettings>(EVENT_NAME, { detail: settings }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('alertSettings');
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AlertSettings>;
        applySettings(normalizeSettings(parsed));
      }
    } catch (err) {
      console.error('Não foi possível carregar configurações de alerta', err);
    }
  }, [applySettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<AlertSettings>;
      if (custom.detail) {
        applySettings(normalizeSettings(custom.detail));
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [applySettings]);

  const saveSettings = useCallback(() => {
    const normalized = normalizeSettings(draftSettings);
    applySettings(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('alertSettings', JSON.stringify(normalized));
    }
    broadcastSettings(normalized);
    return normalized;
  }, [applySettings, broadcastSettings, draftSettings]);

  const resetSettings = useCallback(() => {
    applySettings(DEFAULT_ALERT_SETTINGS);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('alertSettings');
    }
    broadcastSettings(DEFAULT_ALERT_SETTINGS);
    return DEFAULT_ALERT_SETTINGS;
  }, [applySettings, broadcastSettings]);

  return {
    alertSettings,
    draftSettings,
    setDraftSettings,
    saveSettings,
    resetSettings
  };
}

