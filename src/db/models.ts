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
