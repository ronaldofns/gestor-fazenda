/**
 * Migra dados antigos para o novo formato.
 * Migrações que usavam a tabela nascimentos foram removidas (modelo descontinuado).
 */
import { critical } from "../utils/logger";
export async function migrateOldData() {
  try {
    // Outras migrações podem ser adicionadas aqui
  } catch (error) {
    critical("Erro na migração de dados:", error);
  }
}
