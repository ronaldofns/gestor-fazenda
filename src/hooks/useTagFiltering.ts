import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { TagFilterMode } from '../components/TagFilter';

/**
 * Hook para filtrar entidades por tags
 * @param entityIds Lista de IDs das entidades a serem filtradas
 * @param entityType Tipo das entidades ('nascimento', 'matriz', 'fazenda' ou 'animal')
 * @param selectedTagIds IDs das tags selecionadas para filtro
 * @param filterMode Modo de filtro ('any' = qualquer tag, 'all' = todas as tags)
 * @returns Lista filtrada de IDs das entidades que correspondem ao filtro
 */
export function useTagFiltering(
  entityIds: string[],
  entityType: 'nascimento' | 'matriz' | 'fazenda' | 'animal',
  selectedTagIds: string[],
  filterMode: TagFilterMode
): string[] {
  // Buscar todos os assignments do tipo especificado
  const allAssignments = useLiveQuery(
    () => db.tagAssignments
      .where('entityType')
      .equals(entityType)
      .and(a => !a.deletedAt)
      .toArray(),
    [entityType]
  );

  // Filtrar entidades baseado nas tags selecionadas
  const filteredEntityIds = useMemo(() => {
    // Se nenhuma tag selecionada, retorna todas as entidades
    if (!selectedTagIds || selectedTagIds.length === 0) {
      return entityIds;
    }

    // Se não carregou assignments ainda, retorna vazio
    if (!allAssignments) {
      return [];
    }

    // Agrupar assignments por entityId
    const assignmentsByEntity = new Map<string, Set<string>>();
    allAssignments.forEach(assignment => {
      if (!assignmentsByEntity.has(assignment.entityId)) {
        assignmentsByEntity.set(assignment.entityId, new Set());
      }
      assignmentsByEntity.get(assignment.entityId)!.add(assignment.tagId);
    });

    // Filtrar entidades baseado no modo
    return entityIds.filter(entityId => {
      const entityTags = assignmentsByEntity.get(entityId);
      
      // Se entidade não tem tags, não passa no filtro
      if (!entityTags || entityTags.size === 0) {
        return false;
      }

      if (filterMode === 'any') {
        // Modo "qualquer": entidade deve ter pelo menos uma das tags selecionadas
        return selectedTagIds.some(tagId => entityTags.has(tagId));
      } else {
        // Modo "todas": entidade deve ter todas as tags selecionadas
        return selectedTagIds.every(tagId => entityTags.has(tagId));
      }
    });
  }, [entityIds, allAssignments, selectedTagIds, filterMode]);

  return filteredEntityIds;
}
