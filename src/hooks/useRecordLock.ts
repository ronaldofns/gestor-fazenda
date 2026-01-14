import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { checkLock, lockRecord, unlockRecord, RecordLock } from '../utils/recordLock';

export function useRecordLock(
  entityType: RecordLock['entityType'],
  entityId: string | null | undefined
) {
  const { user } = useAuth();
  const [lock, setLock] = useState<RecordLock | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar lock ao montar ou quando entityId mudar
  useEffect(() => {
    if (!entityId || !user) {
      setLock(null);
      setLockError(null);
      setIsLocked(false);
      return;
    }

    const verificar = async () => {
      setIsLoading(true);
      try {
        const existingLock = await checkLock(entityType, entityId);
        
        if (existingLock) {
          if (existingLock.lockedBy === user.id) {
            // Lock do próprio usuário - renovar
            const lockResult = await lockRecord(entityType, entityId, user.id, user.nome);
            if (lockResult.success && lockResult.lock) {
              setLock(lockResult.lock);
              setIsLocked(false);
              setLockError(null);
            }
          } else {
            // Lock de outro usuário
            setLock(existingLock);
            setIsLocked(true);
            setLockError(
              existingLock.lockedByNome 
                ? `Este registro está sendo editado por ${existingLock.lockedByNome}. Tente novamente em alguns minutos.`
                : 'Este registro está sendo editado por outro usuário. Tente novamente em alguns minutos.'
            );
          }
        } else {
          // Sem lock - tentar bloquear
          const lockResult = await lockRecord(entityType, entityId, user.id, user.nome);
          if (lockResult.success && lockResult.lock) {
            setLock(lockResult.lock);
            setIsLocked(false);
            setLockError(null);
          } else {
            setIsLocked(true);
            setLockError(lockResult.error || 'Não foi possível bloquear o registro.');
          }
        }
      } catch (error: any) {
        console.error('Erro ao verificar/bloquear registro:', error);
        setIsLocked(true);
        setLockError('Erro ao verificar bloqueio do registro.');
      } finally {
        setIsLoading(false);
      }
    };

    verificar();

    // Liberar lock ao desmontar
    return () => {
      if (entityId) {
        unlockRecord(entityType, entityId).catch(console.error);
      }
    };
  }, [entityType, entityId, user]);

  const liberarLock = useCallback(async () => {
    if (entityId) {
      await unlockRecord(entityType, entityId);
      setLock(null);
      setIsLocked(false);
      setLockError(null);
    }
  }, [entityType, entityId]);

  const renovarLock = useCallback(async () => {
    if (!entityId || !user) return false;
    
    const lockResult = await lockRecord(entityType, entityId, user.id, user.nome);
    if (lockResult.success && lockResult.lock) {
      setLock(lockResult.lock);
      setIsLocked(false);
      setLockError(null);
      return true;
    }
    return false;
  }, [entityType, entityId, user]);

  return {
    lock,
    lockError,
    isLocked,
    isLoading,
    liberarLock,
    renovarLock
  };
}
