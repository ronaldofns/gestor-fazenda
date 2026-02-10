import { db } from './dexieDB';

/**
 * Migra dados antigos para o novo formato.
 * Migrações que usavam a tabela nascimentos foram removidas (modelo descontinuado).
 */
export async function migrateOldData() {
  try {
    // Outras migrações podem ser adicionadas aqui
  } catch (error) {
    console.error('Erro na migração de dados:', error);
  }
}

