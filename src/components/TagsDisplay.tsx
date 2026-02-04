import { Tag } from '../db/models';
import { Icons } from '../utils/iconMapping';

interface TagsDisplayProps {
  tags: Tag[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Componente para exibir tags de uma entidade
 * @param tags Array de tags a serem exibidas
 * @param maxVisible Número máximo de tags visíveis (padrão: 3)
 * @param size Tamanho das badges ('sm' ou 'md')
 * @param className Classes CSS adicionais
 */
export default function TagsDisplay({ tags, maxVisible = 3, size = 'sm', className = '' }: TagsDisplayProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  const badgeSize = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {visibleTags.map((tag) => (
        <span
          key={tag.id}
          className={`inline-flex items-center gap-1 rounded-full font-medium ${badgeSize}`}
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            borderColor: tag.color,
            borderWidth: '1px',
          }}
          title={tag.description || tag.name}
        >
          <Icons.Tag className={iconSize} />
          <span className="truncate max-w-[80px]">{tag.name}</span>
        </span>
      ))}
      
      {remainingCount > 0 && (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ${badgeSize}`}
          title={`+${remainingCount} ${remainingCount === 1 ? 'tag' : 'tags'}`}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
