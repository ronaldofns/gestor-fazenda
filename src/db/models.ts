export interface Fazenda {
  id: string;
  nome: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Raca {
  id: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Categoria {
  id: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Nascimento {
  id: string;
  matrizId: string;
  fazendaId: string; // ID da fazenda
  mes: number; // Mês do lançamento (1-12)
  ano: number; // Ano do lançamento
  novilha?: boolean; // Checkbox NOVILHA
  vaca?: boolean; // Checkbox VACA
  brincoNumero?: string; // NÚMERO BRINCO
  dataNascimento?: string; // DATA NASCIMENTO
  sexo?: 'M' | 'F'; // SEXO
  raca?: string; // RAÇA
  obs?: string; // OBS
  morto?: boolean; // Status: Morto (true) ou Vivo (false/undefined)
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Desmama {
  id: string;
  nascimentoId: string;
  dataDesmama?: string;
  pesoDesmama?: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Matriz {
  id: string; // UUID interno
  identificador: string; // Código da matriz usado na planilha (ex: 123, V-01, etc.)
  fazendaId: string;
  categoriaId: string; // ID da categoria (ex: novilha, vaca, etc.)
  raca?: string;
  dataNascimento?: string; // dd/mm/yyyy
  pai?: string; // Identificador do pai
  mae?: string; // Identificador da mãe
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export type UserRole = 'admin' | 'gerente' | 'peao' | 'visitante';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string; // Hash da senha (nunca armazenar senha em texto plano)
  role: UserRole;
  fazendaId?: string; // ID da fazenda associada (opcional)
  ativo: boolean; // Se o usuário está ativo
  createdAt: string;
  updatedAt: string;
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}

export type AuditEntity = 'fazenda' | 'raca' | 'categoria' | 'nascimento' | 'desmama' | 'matriz' | 'usuario';

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: string; // UUID interno
  entity: AuditEntity;
  entityId: string; // ID local do registro
  action: AuditAction;
  timestamp: string; // ISO string
  userId?: string | null;
  userNome?: string | null;
  before?: string | null; // JSON com snapshot anterior
  after?: string | null; // JSON com snapshot atual
  description?: string | null;
  synced: boolean;
  remoteId?: number | null;
}

export interface NotificacaoLida {
  id: string; // Chave única da notificação (ex: "desmama-{id}", "mortalidade-{fazendaId}")
  tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz';
  marcadaEm: string; // ISO string
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}

export interface AlertSettingsDB {
  id: string; // Sempre 'alert-settings-global'
  limiteMesesDesmama: number;
  janelaMesesMortalidade: number;
  limiarMortalidade: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}

export interface AppSettingsDB {
  id: string; // Sempre 'app-settings-global'
  timeoutInatividade: number; // Tempo de inatividade em minutos antes de fazer logout (padrão: 15)
  primaryColor?: string; // Cor primária do tema (padrão: 'green')
  createdAt: string;
  updatedAt: string;
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}

// Tipos de permissões disponíveis no sistema
export type PermissionType = 
  | 'importar_planilha'
  | 'gerenciar_usuarios'
  | 'gerenciar_fazendas'
  | 'gerenciar_matrizes'
  | 'gerenciar_racas'
  | 'gerenciar_categorias'
  | 'cadastrar_nascimento'
  | 'editar_nascimento'
  | 'excluir_nascimento'
  | 'cadastrar_desmama'
  | 'editar_desmama'
  | 'excluir_desmama'
  | 'ver_dashboard'
  | 'ver_notificacoes'
  | 'exportar_dados'
  | 'gerar_relatorios';

// Permissão por role
export interface RolePermission {
  id: string; // UUID interno
  role: UserRole; // Role que possui a permissão
  permission: PermissionType; // Tipo de permissão
  granted: boolean; // Se a permissão está concedida
  createdAt: string;
  updatedAt: string;
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}
