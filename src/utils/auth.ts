import CryptoJS from 'crypto-js';
import { db } from '../db/dexieDB';
import { Usuario, UserRole } from '../db/models';
import { uuid } from './uuid';

// Chave para hash (em produção, isso deveria ser mais seguro)
const HASH_KEY = 'gestor-fazenda-auth-key-2024';

/**
 * Gera hash da senha usando SHA256
 */
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password + HASH_KEY).toString();
}

/**
 * Verifica se a senha está correta
 */
export function verifyPassword(password: string, hash: string): boolean {
  const passwordHash = hashPassword(password);
  return passwordHash === hash;
}

/**
 * Cria um novo usuário
 */
export async function createUser(data: {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  fazendaId?: string;
}): Promise<Usuario> {
  // Verificar se email já existe
  const existingUser = await db.usuarios.where('email').equals(data.email.toLowerCase()).first();
  if (existingUser) {
    throw new Error('Email já cadastrado');
  }

  const now = new Date().toISOString();
  const usuario: Usuario = {
    id: uuid(),
    nome: data.nome,
    email: data.email.toLowerCase(),
    senhaHash: hashPassword(data.senha),
    role: data.role,
    fazendaId: data.fazendaId,
    ativo: true,
    createdAt: now,
    updatedAt: now,
    synced: false,
    remoteId: null
  };

  await db.usuarios.add(usuario);

  // Criar usuário no Supabase Auth (auth.users) para login com signInWithPassword e RLS
  try {
    const { supabase } = await import('../api/supabaseClient');
    const { error } = await supabase.auth.signUp({
      email: data.email.toLowerCase(),
      password: data.senha,
      options: { data: { nome: data.nome } },
    });
    if (error && !error.message.includes('already been registered')) {
      console.warn('[Auth] signUp Supabase Auth:', error.message);
    }
  } catch (e) {
    console.warn('[Auth] Erro ao criar usuário no Supabase Auth:', e);
  }

  // Enviar para usuarios_online: criar evento na fila e processar (se online)
  try {
    const { createSyncEvent, processSyncQueue } = await import('./syncEvents');
    await createSyncEvent('UPDATE', 'usuario', usuario.id, usuario);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await processSyncQueue();
    }
  } catch (e) {
    console.warn('[Auth] Erro ao enfileirar/enviar usuário para usuarios_online:', e);
  }

  return usuario;
}

/**
 * Autentica um usuário
 */
export async function authenticateUser(email: string, password: string): Promise<Usuario | null> {
  const usuario = await db.usuarios
    .where('email')
    .equals(email.toLowerCase())
    .first();

  if (!usuario) {
    return null;
  }

  if (!usuario.ativo) {
    throw new Error('Usuário inativo. Entre em contato com o administrador.');
  }

  if (!verifyPassword(password, usuario.senhaHash)) {
    return null;
  }

  return usuario;
}

/**
 * Atualiza um usuário
 */
export async function updateUser(
  id: string,
  data: Partial<{
    nome: string;
    email: string;
    senha: string;
    role: UserRole;
    fazendaId: string;
    ativo: boolean;
  }>
): Promise<void> {
  const updateData: Partial<Usuario> = {
    updatedAt: new Date().toISOString()
  };

  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.email !== undefined) {
    // Verificar se email já existe em outro usuário
    const existingUser = await db.usuarios
      .where('email')
      .equals(data.email.toLowerCase())
      .first();
    if (existingUser && existingUser.id !== id) {
      throw new Error('Email já cadastrado para outro usuário');
    }
    updateData.email = data.email.toLowerCase();
  }
  if (data.senha !== undefined) updateData.senhaHash = hashPassword(data.senha);
  if (data.role !== undefined) updateData.role = data.role;
  if (data.fazendaId !== undefined) updateData.fazendaId = data.fazendaId;
  if (data.ativo !== undefined) updateData.ativo = data.ativo;

  // Marcar como não sincronizado após atualização
  updateData.synced = false;

  await db.usuarios.update(id, updateData);
}

/**
 * Remove um usuário
 */
export async function deleteUser(id: string): Promise<void> {
  const usuario = await db.usuarios.get(id);
  
  // Excluir no servidor se tiver remoteId
  if (usuario?.remoteId) {
    try {
      const { supabase } = await import('../api/supabaseClient');
      const { error } = await supabase.from('usuarios_online').delete().eq('id', usuario.remoteId);
      if (error) {
        // Se o erro for de foreign key constraint, ainda podemos tentar excluir localmente
        // pois com SET NULL, os audits vão manter o histórico sem referência ao usuário
        if (error.code !== '23503' && !error.message?.includes('foreign key')) {
          console.warn('Erro ao excluir usuário no servidor:', error);
        }
      }
    } catch (err) {
      console.warn('Erro ao excluir usuário no servidor:', err);
    }
  }
  
  // Excluir localmente
  await db.usuarios.delete(id);
}

/**
 * Busca todos os usuários
 */
export async function getAllUsers(): Promise<Usuario[]> {
  return await db.usuarios.toArray();
}

/**
 * Busca usuário por ID
 */
export async function getUserById(id: string): Promise<Usuario | undefined> {
  return await db.usuarios.get(id);
}

/**
 * Busca usuário por email
 */
export async function getUserByEmail(email: string): Promise<Usuario | undefined> {
  return await db.usuarios.where('email').equals(email.toLowerCase()).first();
}

