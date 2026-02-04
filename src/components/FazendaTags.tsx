import { Tag } from '../db/models';
import TagsDisplay from './TagsDisplay';

interface FazendaTagsProps {
  tags?: Tag[];
}

/**
 * Componente para exibir tags de uma fazenda
 * Agora recebe as tags diretamente para evitar múltiplos useLiveQuery
 */
export default function FazendaTags({ tags = [] }: FazendaTagsProps) {
  return <TagsDisplay tags={tags} maxVisible={3} size="md" />;
}
