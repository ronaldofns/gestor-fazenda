import { db } from '../db/dexieDB';

/**
 * Corrige o usageCount de todas as tags baseado nos assignments reais
 * Deve ser executado quando houver inconsistências detectadas
 */
export async function fixTagUsageCount(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  try {
    console.log('🔧 Iniciando correção de usageCount...');

    // 1. Buscar todas as tags
    const allTags = await db.tags.toArray();
    console.log(`📋 ${allTags.length} tags encontradas`);

    // 2. Buscar todos os assignments ativos
    const allAssignments = await db.tagAssignments
      .filter(a => !a.deletedAt)
      .toArray();
    console.log(`📌 ${allAssignments.length} assignments ativos`);

    // 3. Contar uso real de cada tag
    const realUsageCount = new Map<string, number>();
    
    for (const assignment of allAssignments) {
      const currentCount = realUsageCount.get(assignment.tagId) || 0;
      realUsageCount.set(assignment.tagId, currentCount + 1);
    }

    // 4. Atualizar cada tag com o valor correto
    for (const tag of allTags) {
      const correctCount = realUsageCount.get(tag.id) || 0;
      
      if (tag.usageCount !== correctCount) {
        console.log(`🔄 Corrigindo tag "${tag.name}": ${tag.usageCount} → ${correctCount}`);
        
        try {
          await db.tags.update(tag.id, {
            usageCount: correctCount,
            updatedAt: new Date().toISOString()
          });
          updated++;
        } catch (err) {
          const errorMsg = `Erro ao atualizar tag ${tag.name}: ${err}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`✅ Correção concluída: ${updated} tags atualizadas`);
    
    return { updated, errors };
  } catch (err) {
    const errorMsg = `Erro geral na correção: ${err}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    return { updated, errors };
  }
}

/**
 * Recalcula o usageCount de UMA tag específica
 */
export async function recalculateTagUsage(tagId: string): Promise<number> {
  const count = await db.tagAssignments
    .where('tagId')
    .equals(tagId)
    .and(a => !a.deletedAt)
    .count();

  await db.tags.update(tagId, {
    usageCount: count,
    updatedAt: new Date().toISOString()
  });

  return count;
}
