export interface Fazenda {
  id: string;
  nome: string;
  logoUrl?: string;
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Raca {
  id: string;
  nome: string;
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Categoria {
  id: string;
  nome: string;
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
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
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Desmama {
  id: string;
  animalId: string; // FK para animais
  dataDesmama?: string;
  pesoDesmama?: number;
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Pesagem {
  id: string;
  animalId: string; // FK para animais
  dataPesagem: string; // Data da pesagem (YYYY-MM-DD)
  peso: number; // Peso em kg
  observacao?: string; // Observações sobre a pesagem
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
}

export interface Vacina {
  id: string;
  animalId: string; // FK para animais
  vacina: string; // Nome da vacina
  dataAplicacao: string; // Data da aplicação (YYYY-MM-DD)
  dataVencimento?: string; // Data de vencimento/revacinação (YYYY-MM-DD)
  lote?: string; // Lote da vacina
  responsavel?: string; // Responsável pela aplicação
  observacao?: string; // Observações sobre a vacinação
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
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
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
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
  lockedBy?: string | null; // ID do usuário que está editando
  lockedByNome?: string | null; // Nome do usuário que está editando
  lockedAt?: string | null; // Timestamp do lock
  createdAt: string;
  updatedAt: string;
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}

export type AuditEntity = 'fazenda' | 'raca' | 'categoria' | 'nascimento' | 'desmama' | 'matriz' | 'usuario' | 'pesagem' | 'vacina' | 'animal' | 'tipoAnimal' | 'statusAnimal' | 'origem' | 'genealogia' | 'confinamento' | 'confinamentoAnimal' | 'confinamentoPesagem' | 'confinamentoAlimentacao' | 'ocorrenciaAnimal';

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
  tipo: 'desmama_atrasada' | 'matriz_improdutiva' | 'peso_critico' | 'vacinas_vencidas' | 'mortalidade_alta' | 'desmama' | 'mortalidade' | 'dados' | 'matriz' | 'peso' | 'vacina';
  usuarioId: string; // ID do usuário que marcou como lido
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
  intervaloSincronizacao: number; // Intervalo de sincronização automática em segundos (padrão: 30)
  primaryColor?: string; // Cor primária do tema (padrão: 'green')
  allowBrowserNotifications?: boolean; // Permitir notificações no navegador (PWA)
  modoCurral?: boolean; // Modo Campo/Curral: UI simplificada, fonte maior, alto contraste (v0.4)
  createdAt: string;
  updatedAt: string;
  synced: boolean; // Se foi sincronizado com o servidor
  remoteId?: number | null; // ID remoto no Supabase
}

// Tipos de permissões disponíveis no sistema (alinhado às funcionalidades atuais)
export type PermissionType = 
  | 'gerenciar_usuarios'
  | 'gerenciar_fazendas'
  | 'gerenciar_racas'
  | 'gerenciar_categorias'
  | 'cadastrar_animal'
  | 'editar_animal'
  | 'excluir_animal'
  | 'cadastrar_desmama'
  | 'editar_desmama'
  | 'excluir_desmama'
  | 'cadastrar_pesagem'
  | 'editar_pesagem'
  | 'excluir_pesagem'
  | 'cadastrar_vacina'
  | 'editar_vacina'
  | 'excluir_vacina'
  | 'ver_dashboard'
  | 'ver_notificacoes'
  | 'ver_sincronizacao'
  | 'ver_planilha'
  | 'ver_fazendas'
  | 'ver_usuarios'
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

// Tipos de entidades que podem ter eventos de sincronização
export type SyncEntity = 'fazenda' | 'raca' | 'categoria' | 'desmama' | 'matriz' | 'usuario' | 'audit' | 'notificacaoLida' | 'alertSettings' | 'appSettings' | 'rolePermission' | 'pesagem' | 'vacina' | 'confinamento' | 'confinamentoAnimal' | 'confinamentoPesagem' | 'confinamentoAlimentacao' | 'ocorrenciaAnimal';

// Tipos de operações de sincronização
export type SyncEventType = 'INSERT' | 'UPDATE' | 'DELETE';

// Evento de sincronização na fila
export interface SyncEvent {
  id: string; // UUID interno
  tipo: SyncEventType; // INSERT, UPDATE, DELETE
  entidade: SyncEntity; // Tipo de entidade (nascimento, desmama, etc.)
  entityId: string; // ID da entidade afetada
  payload: string; // JSON com dados da entidade (para INSERT/UPDATE) ou null (para DELETE)
  tentativas: number; // Número de tentativas de sincronização
  erro?: string | null; // Mensagem de erro da última tentativa
  synced: boolean; // Se foi sincronizado com sucesso
  createdAt: string; // Data de criação do evento
  updatedAt: string; // Data da última atualização
  remoteId?: number | null; // ID remoto no Supabase (se sincronizado)
}

// ========================================
// NOVO SISTEMA DE ANIMAIS
// ========================================

export interface TipoAnimal {
  id: string;
  nome: string; // Bezerro, Novilha, Vaca, Touro, Garrote, Boi, etc.
  descricao?: string;
  ordem?: number; // Para ordenação customizada
  ativo: boolean;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

export interface StatusAnimal {
  id: string;
  nome: string; // Ativo, Vendido, Morto, Transferido, Doente, Quarentena, etc.
  cor?: string; // Cor para identificação visual
  descricao?: string;
  ordem?: number;
  ativo: boolean;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

export interface Origem {
  id: string;
  nome: string; // Nascido na Fazenda, Comprado, Transferido, Doado, etc.
  descricao?: string;
  ordem?: number;
  ativo: boolean;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

export interface Animal {
  id: string; // UUID (chave primária)
  brinco: string; // Número do brinco (identificador visual)
  nome?: string; // Nome do animal (opcional)
  
  // Classificação
  tipoId: string; // FK para tipos_animal (Bezerro, Novilha, Vaca, etc.)
  racaId?: string; // FK para racas
  sexo: 'M' | 'F';
  statusId: string; // FK para status_animal (Ativo, Vendido, etc.)
  
  // Datas
  dataNascimento: string;
  dataCadastro: string; // Quando foi cadastrado no sistema
  dataEntrada?: string; // Quando entrou na fazenda (se comprado/transferido)
  dataSaida?: string; // Quando saiu (venda/morte/transferência)
  
  // Origem e Proprietário
  origemId: string; // FK para origens
  fazendaId: string; // Fazenda atual (proprietário)
  fazendaOrigemId?: string; // Fazenda de origem (se transferido)
  proprietarioAnterior?: string; // Nome do proprietário anterior
  
  // Genealogia (IDs de outros animais)
  matrizId?: string; // ID da mãe (FK para animais)
  reprodutorId?: string; // ID do pai (FK para animais)
  
  // Financeiro
  valorCompra?: number;
  valorVenda?: number;
  
  // Físico
  pelagem?: string; // Cor/pelagem
  pesoAtual?: number; // Último peso registrado
  
  // Agrupamento
  lote?: string;
  categoria?: string; // Categoria personalizada
  
  // Observações
  obs?: string;
  
  // Sistema
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

export interface Genealogia {
  id: string;
  animalId: string; // FK para animais (animal em questão)
  matrizId?: string; // FK para animais (mãe)
  tipoMatrizId?: string; // FK para tipos_animal (Tipo da matriz/mãe)
  reprodutorId?: string; // FK para animais (pai)
  avoMaterna?: string; // FK para animais (avó materna)
  avoPaterna?: string; // FK para animais (avó paterna)
  avoPaternoMaterno?: string; // FK para animais (avô materno)
  avoPaternoPatro?: string; // FK para animais (avô paterno)
  geracoes: number; // Número de gerações registradas
  observacoes?: string;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

// ========================================
// MÓDULO DE CONFINAMENTO
// ========================================

/**
 * Confinamento representa um lote/ciclo de confinamento
 * Um animal pode passar por vários confinamentos ao longo da vida
 */
export interface Confinamento {
  id: string; // UUID (chave primária)
  fazendaId: string; // FK para fazendas
  nome: string; // Ex: "Confinamento Maio/2026 – Terminação"
  dataInicio: string; // Data de início do confinamento (YYYY-MM-DD)
  dataFimPrevista?: string; // Data prevista de término (YYYY-MM-DD)
  dataFimReal?: string; // Data real de término (YYYY-MM-DD)
  status: 'ativo' | 'finalizado' | 'cancelado';
  /** Preço de venda por kg (R$) — opcional, para cálculo da margem estimada */
  precoVendaKg?: number;
  observacoes?: string;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

/**
 * Vínculo entre animal e confinamento
 * Um animal pode ter múltiplos vínculos ao longo do tempo (histórico)
 */
export interface ConfinamentoAnimal {
  id: string; // UUID (chave primária)
  confinamentoId: string; // FK para confinamentos
  animalId: string; // FK para animais
  dataEntrada: string; // Data de entrada no confinamento (YYYY-MM-DD)
  pesoEntrada: number; // Peso na entrada (kg)
  dataSaida?: string; // Data de saída (YYYY-MM-DD) - null se ainda confinado
  pesoSaida?: number; // Peso na saída (kg)
  motivoSaida?: 'abate' | 'venda' | 'morte' | 'outro'; // Motivo da saída
  observacoes?: string;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

/**
 * Pesagens específicas do confinamento
 * Alternativa: reutilizar pesagens gerais com contexto = 'confinamento'
 */
export interface ConfinamentoPesagem {
  id: string; // UUID (chave primária)
  confinamentoAnimalId: string; // FK para confinamento_animais
  data: string; // Data da pesagem (YYYY-MM-DD)
  peso: number; // Peso em kg
  observacoes?: string;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

/**
 * Controle de alimentação e custos do confinamento
 * Fase 2 - opcional no MVP
 */
export interface ConfinamentoAlimentacao {
  id: string; // UUID (chave primária)
  confinamentoId: string; // FK para confinamentos
  data: string; // Data da alimentação (YYYY-MM-DD)
  tipoDieta?: string; // Tipo de dieta aplicada
  custoTotal?: number; // Custo total da alimentação
  observacoes?: string;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}

/**
 * Ocorrência por animal (sanidade: doença, tratamento, morte, outro).
 * Pode ser vinculada ao animal em geral ou a um vínculo de confinamento (confinamentoAnimalId).
 */
export type OcorrenciaTipo = 'doenca' | 'tratamento' | 'morte' | 'outro';

export interface OcorrenciaAnimal {
  id: string;
  animalId: string; // FK para animais
  confinamentoAnimalId?: string; // FK para confinamento_animais (opcional — quando no contexto do confinamento)
  data: string; // YYYY-MM-DD
  tipo: OcorrenciaTipo;
  custo?: number;
  observacoes?: string;
  lockedBy?: string | null;
  lockedByNome?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  remoteId?: number | null;
  deletedAt?: string | null;
}
