import { Tag } from "../db/models";
import TagsDisplay from "./TagsDisplay";

interface AnimalTagsProps {
  tags?: Tag[];
}

/**
 * Componente para exibir tags de um animal
 */
export default function AnimalTags({ tags = [] }: AnimalTagsProps) {
  return <TagsDisplay tags={tags} maxVisible={3} size="sm" />;
}
