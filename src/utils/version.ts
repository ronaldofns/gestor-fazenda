// Versão da aplicação (fonte única: package.json via Vite define)
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

// Data da build (definida no Vite config)
export const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || new Date().toISOString().split('T')[0];

// Informações de versão
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  fullVersion: `${APP_VERSION} (${BUILD_DATE})`
});

