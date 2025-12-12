import { db } from '../db/dexieDB';

/**
 * Remove registros duplicados do banco de dados local
 * Mantém o registro mais recente ou o que tem remoteId
 */
export async function cleanDuplicateNascimentos() {
  try {
    const todosNascimentos = await db.nascimentos.toArray();
    
    // Agrupar por UUID
    const porUuid = new Map<string, typeof todosNascimentos>();
    todosNascimentos.forEach(n => {
      if (!porUuid.has(n.id)) {
        porUuid.set(n.id, []);
      }
      porUuid.get(n.id)!.push(n);
    });
    
    // Encontrar duplicados (mesmo UUID)
    const duplicadosParaRemover: string[] = [];
    
    for (const [uuid, registros] of porUuid.entries()) {
      if (registros.length > 1) {
        // Ordenar: primeiro o que tem remoteId, depois o mais recente
        registros.sort((a, b) => {
          if (a.remoteId && !b.remoteId) return -1;
          if (!a.remoteId && b.remoteId) return 1;
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA; // Mais recente primeiro
        });
        
        // Manter o primeiro (melhor), remover os outros
        const manter = registros[0];
        for (let i = 1; i < registros.length; i++) {
          duplicadosParaRemover.push(registros[i].id);
          console.log(`Removendo duplicado: ${registros[i].id} (mantendo: ${manter.id})`);
        }
      }
    }
    
    // Agrupar por remoteId também (pode ter UUIDs diferentes mas mesmo remoteId)
    const porRemoteId = new Map<number, typeof todosNascimentos>();
    todosNascimentos.forEach(n => {
      if (n.remoteId) {
        if (!porRemoteId.has(n.remoteId)) {
          porRemoteId.set(n.remoteId, []);
        }
        porRemoteId.get(n.remoteId)!.push(n);
      }
    });
    
    // Encontrar duplicados por remoteId
    for (const [remoteId, registros] of porRemoteId.entries()) {
      if (registros.length > 1) {
        // Ordenar: primeiro o que tem UUID correto (se houver no servidor), depois o mais recente
        registros.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA; // Mais recente primeiro
        });
        
        // Manter o primeiro, remover os outros
        const manter = registros[0];
        for (let i = 1; i < registros.length; i++) {
          if (!duplicadosParaRemover.includes(registros[i].id)) {
            duplicadosParaRemover.push(registros[i].id);
            console.log(`Removendo duplicado por remoteId ${remoteId}: ${registros[i].id} (mantendo: ${manter.id})`);
          }
        }
      }
    }
    
    // Remover duplicados
    for (const id of duplicadosParaRemover) {
      try {
        await db.nascimentos.delete(id);
      } catch (err) {
        console.error(`Erro ao remover duplicado ${id}:`, err);
      }
    }
    
    if (duplicadosParaRemover.length > 0) {
      console.log(`✅ Removidos ${duplicadosParaRemover.length} registros duplicados`);
    }
    
    return duplicadosParaRemover.length;
  } catch (error) {
    console.error('Erro ao limpar duplicados:', error);
    return 0;
  }
}

