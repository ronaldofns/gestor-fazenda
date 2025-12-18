import { db } from '../db/dexieDB';
import { AuditAction, AuditEntity } from '../db/models';
import { uuid } from './uuid';

export interface AuditUserInfo {
  id: string;
  nome: string;
}

export interface AuditPayload<T = any> {
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  before?: T | null;
  after?: T | null;
  user?: AuditUserInfo | null;
  description?: string | null;
}

/**
 * Registra um evento de auditoria no IndexedDB.
 * 
 * Obs.: snapshots são salvos como JSON string (before/after) para evitar problemas de schema.
 */
export async function registrarAudit<T = any>(payload: AuditPayload<T>) {
  try {
    const now = new Date().toISOString();
    await db.audits.add({
      id: uuid(),
      entity: payload.entity,
      entityId: payload.entityId,
      action: payload.action,
      timestamp: now,
      userId: payload.user?.id ?? null,
      userNome: payload.user?.nome ?? null,
      before: payload.before != null ? JSON.stringify(payload.before) : null,
      after: payload.after != null ? JSON.stringify(payload.after) : null,
      description: payload.description ?? null,
      synced: false,
      remoteId: null
    });
  } catch (error) {
    // Auditoria nunca deve quebrar o fluxo principal
    console.warn('Falha ao registrar auditoria:', error);
  }
}


