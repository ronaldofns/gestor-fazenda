/**
 * Textos em português (pt-BR).
 * Estrutura preparada para futura tradução: substitua strings fixas por t('chave').
 */

export const ptBR: Record<string, string> = {
  // App
  'app.title': 'Gestor Fazenda',
  'app.subtitle': 'Sistema de Gestão de Rebanho',

  // Comum
  'common.save': 'Salvar',
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.loading': 'Carregando...',
  'common.delete': 'Excluir',
  'common.edit': 'Editar',
  'common.add': 'Adicionar',
  'common.export': 'Exportar',
  'common.import': 'Importar',
  'common.search': 'Buscar',
  'common.yes': 'Sim',
  'common.no': 'Não',

  // Login
  'login.title': 'Entrar',
  'login.submit': 'Entrar no sistema',
  'login.submitting': 'Entrando...',
  'login.email': 'Email',
  'login.password': 'Senha',
  'login.emailPlaceholder': 'seu@email.com',
  'login.passwordPlaceholder': 'Sua senha',
  'login.emailRequired': 'Email é obrigatório',
  'login.passwordRequired': 'Senha é obrigatória',
  'login.syncUsers': 'Sincronizando usuários...',
  'login.fetchingUsers': 'Buscando usuários do servidor',
  'login.formLabel': 'Formulário de login',
  'login.devQuickAccess': 'Acesso rápido DEV',

  // Menu / Navegação
  'menu.open': 'Abrir menu',
  'menu.close': 'Fechar menu',
  'menu.dashboard': 'Dashboard',
  'menu.animals': 'Animais',
  'menu.farms': 'Fazendas',
  'menu.settings': 'Configurações',

  // Modal
  'modal.dialog': 'Diálogo',

  // Acessibilidade
  'a11y.closeDialog': 'Fechar diálogo'
};

const locale = 'pt-BR';
const messages: Record<string, Record<string, string>> = { 'pt-BR': ptBR };

/**
 * Retorna a tradução para a chave no locale atual.
 * Uso: t('common.save') => 'Salvar'
 */
export function t(key: string): string {
  const dict = messages[locale] ?? ptBR;
  return dict[key] ?? key;
}

export type Locale = 'pt-BR';
export const defaultLocale: Locale = 'pt-BR';
