import { db } from '../db/dexieDB';

const LOCK_TTL_MINUTES = 10; // TTL de 10 minutos

export interface RecordLock {
  entityId: string;
  entityType: 'desmama' | 'matriz' | 'fazenda' | 'raca' | 'categoria' | 'usuario' | 'pesagem' | 'vacina';
  lockedBy: string; // userId
  lockedByNome?: string; // Nome do usuário que bloqueou
  lockedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp (lockedAt + TTL)
}

/**
 * Verifica se um registro está bloqueado
 * Retorna o lock se estiver bloqueado e válido, null caso contrário
 */
export async function checkLock(
  entityType: RecordLock['entityType'],
  entityId: string
): Promise<RecordLock | null> {
  try {
    // Buscar o registro na tabela apropriada
    let record: any = null;
    
    switch (entityType) {
      case 'desmama':
        record = await db.desmamas.get(entityId);
        break;
      case 'pesagem':
        record = await db.pesagens.get(entityId);
        break;
      case 'vacina':
        record = await db.vacinacoes.get(entityId);
        break;
      case 'matriz':
        record = await db.matrizes.get(entityId);
        break;
      case 'fazenda':
        record = await db.fazendas.get(entityId);
        break;
      case 'raca':
        record = await db.racas.get(entityId);
        break;
      case 'categoria':
        record = await db.categorias.get(entityId);
        break;
      case 'usuario':
        record = await db.usuarios.get(entityId);
        break;
    }

    if (!record) {
      return null; // Registro não existe
    }

    // Verificar se tem lock
    if (!record.lockedBy || !record.lockedAt) {
      return null; // Sem lock
    }

    // Verificar se o lock expirou
    const lockedAt = new Date(record.lockedAt);
    const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
    const now = new Date();

    if (now > expiresAt) {
      // Lock expirado - remover automaticamente
      await unlockRecord(entityType, entityId);
      return null;
    }

    // Retornar informações do lock
    return {
      entityId,
      entityType,
      lockedBy: record.lockedBy,
      lockedByNome: record.lockedByNome,
      lockedAt: record.lockedAt,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Erro ao verificar lock:', error);
    return null;
  }
}

/**
 * Bloqueia um registro para edição
 * Retorna true se conseguiu bloquear, false se já está bloqueado por outro usuário
 */
export async function lockRecord(
  entityType: RecordLock['entityType'],
  entityId: string,
  userId: string,
  userNome?: string
): Promise<{ success: boolean; lock?: RecordLock; error?: string }> {
  try {
    // Verificar se já está bloqueado
    const existingLock = await checkLock(entityType, entityId);
    
    if (existingLock) {
      // Se o lock é do mesmo usuário, renovar
      if (existingLock.lockedBy === userId) {
        await updateLock(entityType, entityId, userId, userNome);
        return { success: true, lock: existingLock };
      }
      
      // Lock de outro usuário
      return {
        success: false,
        error: `Este registro está sendo editado por ${existingLock.lockedByNome || 'outro usuário'}. Tente novamente em alguns minutos.`
      };
    }

    // Criar novo lock
    await updateLock(entityType, entityId, userId, userNome);
    
    const lock: RecordLock = {
      entityId,
      entityType,
      lockedBy: userId,
      lockedByNome: userNome,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000).toISOString()
    };

    return { success: true, lock };
  } catch (error: any) {
    console.error('Erro ao bloquear registro:', error);
    return { success: false, error: error.message || 'Erro ao bloquear registro' };
  }
}

/**
 * Atualiza o lock de um registro (renova TTL)
 */
async function updateLock(
  entityType: RecordLock['entityType'],
  entityId: string,
  userId: string,
  userNome?: string
): Promise<void> {
  const now = new Date().toISOString();
  const updateData: any = {
    lockedBy: userId,
    lockedAt: now,
    updatedAt: now
  };

  if (userNome) {
    updateData.lockedByNome = userNome;
  }

  switch (entityType) {
    case 'desmama':
      await db.desmamas.update(entityId, updateData);
      break;
    case 'pesagem':
      await db.pesagens.update(entityId, updateData);
      break;
    case 'vacina':
      await db.vacinacoes.update(entityId, updateData);
      break;
    case 'matriz':
      await db.matrizes.update(entityId, updateData);
      break;
    case 'fazenda':
      await db.fazendas.update(entityId, updateData);
      break;
    case 'raca':
      await db.racas.update(entityId, updateData);
      break;
    case 'categoria':
      await db.categorias.update(entityId, updateData);
      break;
    case 'usuario':
      await db.usuarios.update(entityId, updateData);
      break;
  }
}

/**
 * Libera o lock de um registro
 */
export async function unlockRecord(
  entityType: RecordLock['entityType'],
  entityId: string
): Promise<void> {
  try {
    const updateData: any = {
      lockedBy: null,
      lockedByNome: null,
      lockedAt: null,
      updatedAt: new Date().toISOString()
    };

    switch (entityType) {
      case 'desmama':
        await db.desmamas.update(entityId, updateData);
        break;
      case 'pesagem':
        await db.pesagens.update(entityId, updateData);
        break;
      case 'vacina':
        await db.vacinacoes.update(entityId, updateData);
        break;
      case 'matriz':
        await db.matrizes.update(entityId, updateData);
        break;
      case 'fazenda':
        await db.fazendas.update(entityId, updateData);
        break;
      case 'raca':
        await db.racas.update(entityId, updateData);
        break;
      case 'categoria':
        await db.categorias.update(entityId, updateData);
        break;
      case 'usuario':
        await db.usuarios.update(entityId, updateData);
        break;
    }
  } catch (error) {
    console.error('Erro ao liberar lock:', error);
  }
}

/**
 * Limpa locks expirados de todas as tabelas
 */
export async function cleanupExpiredLocks(): Promise<number> {
  let cleaned = 0;
  const now = new Date();

  try {
    // Limpar locks de desmamas
    const desmamas = await db.desmamas.toArray();
    for (const desmama of desmamas) {
      if (desmama.lockedAt) {
        const lockedAt = new Date(desmama.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('desmama', desmama.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de pesagens
    const pesagens = await db.pesagens.toArray();
    for (const pesagem of pesagens) {
      if (pesagem.lockedAt) {
        const lockedAt = new Date(pesagem.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('pesagem', pesagem.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de vacinações
    const vacinacoes = await db.vacinacoes.toArray();
    for (const vacina of vacinacoes) {
      if (vacina.lockedAt) {
        const lockedAt = new Date(vacina.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('vacina', vacina.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de matrizes
    const matrizes = await db.matrizes.toArray();
    for (const matriz of matrizes) {
      if (matriz.lockedAt) {
        const lockedAt = new Date(matriz.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('matriz', matriz.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de fazendas
    const fazendas = await db.fazendas.toArray();
    for (const fazenda of fazendas) {
      if (fazenda.lockedAt) {
        const lockedAt = new Date(fazenda.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('fazenda', fazenda.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de raças
    const racas = await db.racas.toArray();
    for (const raca of racas) {
      if (raca.lockedAt) {
        const lockedAt = new Date(raca.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('raca', raca.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de categorias
    const categorias = await db.categorias.toArray();
    for (const categoria of categorias) {
      if (categoria.lockedAt) {
        const lockedAt = new Date(categoria.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('categoria', categoria.id);
          cleaned++;
        }
      }
    }

    // Limpar locks de usuários
    const usuarios = await db.usuarios.toArray();
    for (const usuario of usuarios) {
      if (usuario.lockedAt) {
        const lockedAt = new Date(usuario.lockedAt);
        const expiresAt = new Date(lockedAt.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
        if (now > expiresAt) {
          await unlockRecord('usuario', usuario.id);
          cleaned++;
        }
      }
    }
  } catch (error) {
    console.error('Erro ao limpar locks expirados:', error);
  }

  return cleaned;
}
