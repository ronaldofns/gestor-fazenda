/**
 * Estado derivado do confinamento — não confiar em status manual.
 * Regras:
 * - Animal ativo: dataSaida IS NULL
 * - Animal finalizado: dataSaida NOT NULL
 * - Confinamento ativo: existe pelo menos 1 animal com dataSaida NULL
 * - Confinamento finalizado: todos os animais têm dataSaida
 * - cancelado: só vem do status gravado (decisão manual)
 */

import type { Confinamento, ConfinamentoAnimal } from '../db/models';

export type EstadoAnimalConfinamento = 'ativo' | 'finalizado';
export type EstadoConfinamentoDerivado = 'ativo' | 'finalizado' | 'cancelado';

/**
 * Estado do animal no confinamento (derivado só de dataSaida).
 */
export function estadoAnimalConfinamento(v: ConfinamentoAnimal): EstadoAnimalConfinamento {
  return v.dataSaida == null ? 'ativo' : 'finalizado';
}

/**
 * Estado do confinamento derivado dos vínculos.
 * cancelado: usa o status gravado no registro.
 * ativo/finalizado: derivado — pelo menos um animal sem dataSaida = ativo; todos com dataSaida = finalizado.
 */
export function estadoConfinamentoDerivado(
  confinamento: Confinamento,
  vínculos: ConfinamentoAnimal[]
): EstadoConfinamentoDerivado {
  if (confinamento.status === 'cancelado') return 'cancelado';
  const temAlgumAtivo = vínculos.some(v => v.dataSaida == null);
  return temAlgumAtivo ? 'ativo' : 'finalizado';
}

/**
 * Retorna true se o confinamento está ativo (derivado).
 */
export function isConfinamentoAtivo(
  confinamento: Confinamento,
  vínculos: ConfinamentoAnimal[]
): boolean {
  return estadoConfinamentoDerivado(confinamento, vínculos) === 'ativo';
}

/**
 * Retorna true se o confinamento está finalizado (derivado).
 */
export function isConfinamentoFinalizado(
  confinamento: Confinamento,
  vínculos: ConfinamentoAnimal[]
): boolean {
  return estadoConfinamentoDerivado(confinamento, vínculos) === 'finalizado';
}

/**
 * Deriva estado quando você já tem apenas totais (ex.: lista).
 * ativos = número de vínculos com dataSaida NULL.
 */
export function estadoConfinamentoPorTotais(
  confinamento: Confinamento,
  totalAnimais: number,
  ativos: number
): EstadoConfinamentoDerivado {
  if (confinamento.status === 'cancelado') return 'cancelado';
  return ativos > 0 ? 'ativo' : 'finalizado';
}
