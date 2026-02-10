/**
 * Regras de unicidade para evitar duplicidade e inconsistência.
 * - Animal: (fazendaId, brinco) único
 * - Pesagem: (animalId, dataPesagem) único
 * - ConfinamentoPesagem: (confinamentoAnimalId, data) único
 */

import { db } from '../db/dexieDB';

export interface ResultadoUnicidade {
  valido: boolean;
  erro?: string;
}

/**
 * Valida se já existe outro animal na mesma fazenda com o mesmo brinco.
 * Ao editar, informe excludeAnimalId para ignorar o próprio registro.
 */
export async function validarBrincoUnico(
  fazendaId: string,
  brinco: string,
  excludeAnimalId?: string
): Promise<ResultadoUnicidade> {
  const brincoNorm = String(brinco ?? '').trim();
  if (!brincoNorm) {
    return { valido: false, erro: 'Brinco é obrigatório.' };
  }
  const existentes = await db.animais
    .where('[fazendaId+brinco]')
    .equals([fazendaId, brincoNorm])
    .toArray();
  const conflito = existentes.find(a => !a.deletedAt && a.id !== excludeAnimalId);
  if (conflito) {
    return {
      valido: false,
      erro: `Já existe um animal na mesma fazenda com o brinco "${brincoNorm}". Use outro número.`
    };
  }
  return { valido: true };
}

/**
 * Valida se já existe pesagem para o mesmo animal na mesma data.
 * Ao editar, informe excludePesagemId para ignorar o próprio registro.
 */
export async function validarPesagemUnica(
  animalId: string,
  dataPesagem: string,
  excludePesagemId?: string
): Promise<ResultadoUnicidade> {
  const dataNorm = (dataPesagem ?? '').trim();
  if (!dataNorm) {
    return { valido: false, erro: 'Data da pesagem é obrigatória.' };
  }
  const todas = await db.pesagens.where('animalId').equals(animalId).toArray();
  const conflito = todas.find(
    p => p.dataPesagem === dataNorm && p.id !== excludePesagemId
  );
  if (conflito) {
    return {
      valido: false,
      erro: `Já existe uma pesagem para este animal na data ${dataNorm}. Use outra data ou edite a pesagem existente.`
    };
  }
  return { valido: true };
}

/**
 * Valida se já existe pesagem de confinamento para o mesmo vínculo na mesma data.
 * Ao editar, informe excludePesagemId para ignorar o próprio registro.
 */
export async function validarConfinamentoPesagemUnica(
  confinamentoAnimalId: string,
  data: string,
  excludePesagemId?: string
): Promise<ResultadoUnicidade> {
  const dataNorm = (data ?? '').trim();
  if (!dataNorm) {
    return { valido: false, erro: 'Data da pesagem é obrigatória.' };
  }
  const todas = await db.confinamentoPesagens
    .where('confinamentoAnimalId')
    .equals(confinamentoAnimalId)
    .and(p => p.deletedAt == null)
    .toArray();
  const conflito = todas.find(
    p => p.data === dataNorm && p.id !== excludePesagemId
  );
  if (conflito) {
    return {
      valido: false,
      erro: `Já existe uma pesagem para este animal no confinamento na data ${dataNorm}. Use outra data ou edite a pesagem existente.`
    };
  }
  return { valido: true };
}
