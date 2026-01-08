// Versão da aplicação - sincronizada com package.json
export const APP_VERSION = '0.1.1';

// Data da build (será substituída durante o build)
export const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || new Date().toISOString().split('T')[0];

// Informações de versão
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  fullVersion: `${APP_VERSION} (${BUILD_DATE})`
});

