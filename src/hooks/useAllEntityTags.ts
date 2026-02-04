import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Tag } from '../db/models';

/**
 * Hook otimizado para buscar tags de múltiplas entidades de uma vez
 * Evita criar múltiplas subscriptions (memory leak)
 * @param entityType Tipo das entidades ('nascimento', 'matriz', 'fazenda' ou 'animal')
 * @returns Map de entityId -> Tag[]
 */
export function useAllEntityTags(entityType: 'nascimento' | 'matriz' | 'fazenda' | 'animal'): Map<string, Tag[]> {
  // Buscar TODOS os assignments do tipo uma única vez
  const assignments = useLiveQuery(
    () => db.tagAssignments
      .where('entityType')
      .equals(entityType)
      .and(a => !a.deletedAt)
      .toArray(),
    [entityType]
  );

  // Buscar TODAS as tags uma única vez
  const allTags = useLiveQuery(() => db.tags.filter(t => !t.deletedAt).toArray(), []);

  // Criar mapa de entityId -> tags
  const entityTagsMap = useMemo(() => {
    const map = new Map<string, Tag[]>();
    
    if (!assignments || !allTags) return map;

    // Criar mapa tagId -> Tag para lookup rápido
    const tagMap = new Map<string, Tag>();
    allTags.forEach(tag => tagMap.set(tag.id, tag));

    // Agrupar assignments por entityId
    const assignmentsByEntity = new Map<string, string[]>();
    assignments.forEach(assignment => {
      if (!assignmentsByEntity.has(assignment.entityId)) {
        assignmentsByEntity.set(assignment.entityId, []);
      }
      assignmentsByEntity.get(assignment.entityId)!.push(assignment.tagId);
    });

    // Mapear tags para cada entidade
    assignmentsByEntity.forEach((tagIds, entityId) => {
      const tags = tagIds
        .map(tagId => tagMap.get(tagId))
        .filter((tag): tag is Tag => tag !== undefined);
      if (tags.length > 0) {
        map.set(entityId, tags);
      }
    });

    return map;
  }, [assignments, allTags]);

  return entityTagsMap;
}
