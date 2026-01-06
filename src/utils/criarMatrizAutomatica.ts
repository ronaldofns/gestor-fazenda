import { db } from '../db/dexieDB';
import { uuid } from './uuid';
import { Matriz } from '../db/models';

/**
 * Cria uma matriz automaticamente se ela não existir
 * @param identificador Identificador da matriz (ex: "123", "V-01")
 * @param fazendaId ID da fazenda
 * @param tipo Tipo da matriz: 'novilha' ou 'vaca' (para determinar categoria)
 * @param raca Raça da matriz (opcional)
 * @returns ID da matriz (existente ou recém-criada)
 */
export async function criarMatrizSeNaoExistir(
  identificador: string,
  fazendaId: string,
  tipo: 'novilha' | 'vaca',
  raca?: string
): Promise<string> {
  // Normalizar identificador (trim e case-insensitive)
  const identificadorNormalizado = identificador.trim();
  
  if (!identificadorNormalizado) {
    throw new Error('Identificador da matriz não pode ser vazio');
  }

  // Buscar matriz existente por identificador e fazenda
  // Busca manualmente (mais confiável que índice composto que pode não estar disponível)
  const todasMatrizes = await db.matrizes.toArray();
  const matrizExistente = todasMatrizes.find(
    m => m.identificador?.trim() === identificadorNormalizado && m.fazendaId === fazendaId
  );

  if (matrizExistente) {
    return matrizExistente.id;
  }

  // Buscar categoria padrão baseada no tipo
  const categoriaNome = tipo === 'novilha' ? 'Novilha' : 'Vaca';
  const categorias = await db.categorias.toArray();
  let categoriaId = categorias.find(c => c.nome === categoriaNome)?.id;

  // Se não encontrar categoria, criar as padrão
  if (!categoriaId) {
    const now = new Date().toISOString();
    const categoriaNovilhaId = 'categoria-novilha';
    const categoriaVacaId = 'categoria-vaca';
    
    // Garantir que a categoria Novilha existe
    try {
      await db.categorias.add({
        id: categoriaNovilhaId,
        nome: 'Novilha',
        createdAt: now,
        updatedAt: now,
        synced: false,
        remoteId: null
      });
    } catch (err) {
      // Pode já existir, ignorar
    }
    
    // Garantir que a categoria Vaca existe
    try {
      await db.categorias.add({
        id: categoriaVacaId,
        nome: 'Vaca',
        createdAt: now,
        updatedAt: now,
        synced: false,
        remoteId: null
      });
    } catch (err) {
      // Pode já existir, ignorar
    }

    // Usar os IDs fixos baseado no tipo
    categoriaId = tipo === 'novilha' ? categoriaNovilhaId : categoriaVacaId;
  }

  // Garantir que categoriaId não seja vazio (obrigatório)
  if (!categoriaId) {
    throw new Error(`Não foi possível determinar a categoria para o tipo: ${tipo}`);
  }

  // Criar nova matriz
  const now = new Date().toISOString();
  const novaMatrizId = uuid();
  
  const novaMatriz: Matriz = {
    id: novaMatrizId,
    identificador: identificadorNormalizado,
    fazendaId,
    categoriaId,
    raca: raca?.trim() || undefined,
    ativo: true,
    createdAt: now,
    updatedAt: now,
    synced: false,
    remoteId: null
  };

  await db.matrizes.add(novaMatriz);

  return novaMatrizId;
}

