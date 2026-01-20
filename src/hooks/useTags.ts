import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Sistema de tags customizáveis para categorização avançada
 * Permite criar, gerenciar e filtrar dados por tags
 */

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  category?: string; // Para agrupar tags (ex: "Status", "Tipo", "Prioridade")
  createdAt: string;
  usageCount: number;
}

export interface TagAssignment {
  entityId: string; // ID do nascimento, matriz, etc.
  entityType: 'nascimento' | 'matriz' | 'fazenda';
  tagIds: string[];
  updatedAt: string;
}

const TAGS_KEY = 'gf-tags';
const ASSIGNMENTS_KEY = 'gf-tag-assignments';

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4'  // cyan
];

export function useTags() {
  // Tags
  const [tags, setTags] = useState<Tag[]>(() => {
    try {
      const stored = localStorage.getItem(TAGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
      return [];
    }
  });

  // Atribuições de tags
  const [assignments, setAssignments] = useState<TagAssignment[]>(() => {
    try {
      const stored = localStorage.getItem(ASSIGNMENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar atribuições:', error);
      return [];
    }
  });

  // Salvar tags
  useEffect(() => {
    try {
      localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    } catch (error) {
      console.error('Erro ao salvar tags:', error);
    }
  }, [tags]);

  // Salvar atribuições
  useEffect(() => {
    try {
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    } catch (error) {
      console.error('Erro ao salvar atribuições:', error);
    }
  }, [assignments]);

  // Criar tag
  const createTag = useCallback(
    (name: string, color?: string, category?: string, description?: string): Tag => {
      const newTag: Tag = {
        id: crypto.randomUUID(),
        name: name.trim(),
        color: color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
        category,
        description,
        createdAt: new Date().toISOString(),
        usageCount: 0
      };

      setTags(prev => [...prev, newTag]);
      return newTag;
    },
    []
  );

  // Atualizar tag
  const updateTag = useCallback((id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt' | 'usageCount'>>) => {
    setTags(prev =>
      prev.map(tag => (tag.id === id ? { ...tag, ...updates } : tag))
    );
  }, []);

  // Deletar tag
  const deleteTag = useCallback((id: string) => {
    // Remover tag
    setTags(prev => prev.filter(tag => tag.id !== id));

    // Remover todas as atribuições desta tag
    setAssignments(prev =>
      prev.map(assignment => ({
        ...assignment,
        tagIds: assignment.tagIds.filter(tagId => tagId !== id),
        updatedAt: new Date().toISOString()
      })).filter(assignment => assignment.tagIds.length > 0)
    );
  }, []);

  // Atribuir tags a uma entidade
  const assignTags = useCallback(
    (entityId: string, entityType: TagAssignment['entityType'], tagIds: string[]) => {
      setAssignments(prev => {
        const existing = prev.find(
          a => a.entityId === entityId && a.entityType === entityType
        );

        if (existing) {
          // Atualizar existente
          return prev.map(a =>
            a.entityId === entityId && a.entityType === entityType
              ? { ...a, tagIds, updatedAt: new Date().toISOString() }
              : a
          );
        } else {
          // Criar novo
          return [
            ...prev,
            {
              entityId,
              entityType,
              tagIds,
              updatedAt: new Date().toISOString()
            }
          ];
        }
      });

      // Atualizar contadores de uso
      setTags(prev =>
        prev.map(tag => {
          if (tagIds.includes(tag.id)) {
            return { ...tag, usageCount: tag.usageCount + 1 };
          }
          return tag;
        })
      );
    },
    []
  );

  // Remover tags de uma entidade
  const removeTags = useCallback((entityId: string, entityType: TagAssignment['entityType']) => {
    setAssignments(prev =>
      prev.filter(a => !(a.entityId === entityId && a.entityType === entityType))
    );
  }, []);

  // Obter tags de uma entidade
  const getEntityTags = useCallback(
    (entityId: string, entityType: TagAssignment['entityType']): Tag[] => {
      const assignment = assignments.find(
        a => a.entityId === entityId && a.entityType === entityType
      );

      if (!assignment) return [];

      return assignment.tagIds
        .map(id => tags.find(tag => tag.id === id))
        .filter((tag): tag is Tag => tag !== undefined);
    },
    [assignments, tags]
  );

  // Obter todas as entidades com uma tag específica
  const getEntitiesByTag = useCallback(
    (tagId: string, entityType?: TagAssignment['entityType']): TagAssignment[] => {
      return assignments.filter(
        a =>
          a.tagIds.includes(tagId) &&
          (entityType === undefined || a.entityType === entityType)
      );
    },
    [assignments]
  );

  // Filtrar entidades por múltiplas tags (AND lógico)
  const filterByTags = useCallback(
    (tagIds: string[], entityType?: TagAssignment['entityType']): string[] => {
      if (tagIds.length === 0) return [];

      const filtered = assignments.filter(a => {
        if (entityType && a.entityType !== entityType) return false;
        // Todas as tags devem estar presentes
        return tagIds.every(tagId => a.tagIds.includes(tagId));
      });

      return filtered.map(a => a.entityId);
    },
    [assignments]
  );

  // Tags mais usadas
  const popularTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
  }, [tags]);

  // Tags por categoria
  const tagsByCategory = useMemo(() => {
    const map = new Map<string, Tag[]>();
    
    tags.forEach(tag => {
      const category = tag.category || 'Sem categoria';
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(tag);
    });

    return map;
  }, [tags]);

  // Buscar tags
  const searchTags = useCallback(
    (query: string): Tag[] => {
      const lowerQuery = query.toLowerCase();
      return tags.filter(
        tag =>
          tag.name.toLowerCase().includes(lowerQuery) ||
          tag.description?.toLowerCase().includes(lowerQuery) ||
          tag.category?.toLowerCase().includes(lowerQuery)
      );
    },
    [tags]
  );

  // Exportar tags
  const exportTags = useCallback(() => {
    const data = {
      tags,
      assignments,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tags-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [tags, assignments]);

  // Importar tags
  const importTags = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!data.tags || !Array.isArray(data.tags)) {
            throw new Error('Formato inválido');
          }

          // Gerar novos IDs para evitar conflitos
          const idMap = new Map<string, string>();
          const importedTags = data.tags.map((tag: Tag) => {
            const newId = crypto.randomUUID();
            idMap.set(tag.id, newId);
            return {
              ...tag,
              id: newId,
              createdAt: new Date().toISOString(),
              usageCount: 0
            };
          });

          // Atualizar referências nas atribuições
          const importedAssignments = (data.assignments || []).map((assignment: TagAssignment) => ({
            ...assignment,
            tagIds: assignment.tagIds.map(id => idMap.get(id) || id),
            updatedAt: new Date().toISOString()
          }));

          setTags(prev => [...prev, ...importedTags]);
          setAssignments(prev => [...prev, ...importedAssignments]);

          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  // Limpar todas as tags e atribuições
  // NOTA: Esta função não mostra confirmação. O componente que a chama deve fazer isso.
  const clearAll = useCallback(() => {
    setTags([]);
    setAssignments([]);
  }, []);

  // Estatísticas
  const stats = useMemo(() => {
    const totalTags = tags.length;
    const totalAssignments = assignments.length;
    const categories = new Set(tags.map(t => t.category || 'Sem categoria')).size;
    const totalUsage = tags.reduce((acc, tag) => acc + tag.usageCount, 0);

    const byEntityType = {
      nascimento: assignments.filter(a => a.entityType === 'nascimento').length,
      matriz: assignments.filter(a => a.entityType === 'matriz').length,
      fazenda: assignments.filter(a => a.entityType === 'fazenda').length
    };

    return {
      totalTags,
      totalAssignments,
      categories,
      totalUsage,
      byEntityType
    };
  }, [tags, assignments]);

  return {
    tags,
    assignments,
    createTag,
    updateTag,
    deleteTag,
    assignTags,
    removeTags,
    getEntityTags,
    getEntitiesByTag,
    filterByTags,
    popularTags,
    tagsByCategory,
    searchTags,
    exportTags,
    importTags,
    clearAll,
    stats
  };
}
