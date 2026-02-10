/**
 * Views lógicas do confinamento (não são tabelas).
 * ConfinamentoAnimalResumo: por animal no confinamento (dias, GMD, estado).
 * ConfinamentoResumo: por confinamento (totais, GMD médio simples e ponderado).
 */

import type { Confinamento, ConfinamentoAnimal } from '../db/models';
import { estadoAnimalConfinamento, estadoConfinamentoDerivado, type EstadoAnimalConfinamento, type EstadoConfinamentoDerivado } from './confinamentoEstado';
import { calcularGMD, calcularGMDParcial } from './confinamentoRules';

export interface ConfinamentoAnimalResumo {
  /** ID do vínculo (ConfinamentoAnimal.id) */
  id: string;
  confinamentoAnimalId: string;
  animalId: string;
  confinamentoId: string;
  dataEntrada: string;
  dataSaida: string | undefined;
  pesoEntrada: number;
  pesoSaida: number | undefined;
  /** Dias confinado (até saída ou hoje) */
  diasConfinado: number;
  /** GMD em kg/dia (null se não dá para calcular) */
  gmd: number | null;
  estadoDerivado: EstadoAnimalConfinamento;
}

export interface ConfinamentoResumo {
  confinamentoId: string;
  confinamento: Confinamento;
  totalAnimais: number;
  ativos: number;
  finalizados: number;
  estadoDerivado: EstadoConfinamentoDerivado;
  /** Média simples dos GMDs (só quem tem GMD) */
  gmdMedioSimples: number;
  /** Média ponderada por dias: sum(gmd_i * dias_i) / sum(dias_i) */
  gmdMedioPonderado: number;
  pesoMedioEntrada: number;
  pesoMedioSaida: number;
  diasMedio: number;
  mortalidade: number;
}

/**
 * Monta o resumo de um vínculo animal-confinamento.
 * Para ativos: usa pesoAtual (última pesagem ou animal.pesoAtual) e calcula GMD parcial.
 */
export function montarConfinamentoAnimalResumo(
  vínculo: ConfinamentoAnimal,
  pesoAtual?: number | null
): ConfinamentoAnimalResumo {
  const estado = estadoAnimalConfinamento(vínculo);
  let diasConfinado = 0;
  let gmd: number | null = null;

  if (vínculo.dataSaida && vínculo.pesoSaida != null) {
    const res = calcularGMD(vínculo.pesoEntrada, vínculo.pesoSaida, vínculo.dataEntrada, vínculo.dataSaida);
    diasConfinado = res.dias;
    gmd = res.gmd;
  } else {
    const res = calcularGMDParcial(vínculo.pesoEntrada, pesoAtual ?? undefined, vínculo.dataEntrada);
    diasConfinado = res.dias;
    gmd = res.gmd;
  }

  return {
    id: vínculo.id,
    confinamentoAnimalId: vínculo.id,
    animalId: vínculo.animalId,
    confinamentoId: vínculo.confinamentoId,
    dataEntrada: vínculo.dataEntrada,
    dataSaida: vínculo.dataSaida,
    pesoEntrada: vínculo.pesoEntrada,
    pesoSaida: vínculo.pesoSaida,
    diasConfinado,
    gmd,
    estadoDerivado: estado
  };
}

/**
 * Monta o resumo de um confinamento a partir dos vínculos e resumos por animal.
 */
export function montarConfinamentoResumo(
  confinamento: Confinamento,
  vínculos: ConfinamentoAnimal[],
  resumosAnimais: ConfinamentoAnimalResumo[]
): ConfinamentoResumo {
  const estado = estadoConfinamentoDerivado(confinamento, vínculos);
  const ativos = vínculos.filter(v => v.dataSaida == null).length;
  const finalizados = vínculos.length - ativos;
  const mortalidade = vínculos.filter(v => v.motivoSaida === 'morte').length;

  const pesoMedioEntrada = vínculos.length > 0
    ? vínculos.reduce((s, v) => s + v.pesoEntrada, 0) / vínculos.length
    : 0;

  const comPesoSaida = vínculos.filter(v => v.pesoSaida != null);
  const pesoMedioSaida = comPesoSaida.length > 0
    ? comPesoSaida.reduce((s, v) => s + (v.pesoSaida ?? 0), 0) / comPesoSaida.length
    : 0;

  const comGmd = resumosAnimais.filter(r => r.gmd != null && r.diasConfinado > 0);
  const gmdMedioSimples = comGmd.length > 0
    ? comGmd.reduce((s, r) => s + (r.gmd ?? 0), 0) / comGmd.length
    : 0;

  let gmdMedioPonderado = 0;
  const somaPonderada = comGmd.reduce((s, r) => s + (r.gmd ?? 0) * r.diasConfinado, 0);
  const totalDias = comGmd.reduce((s, r) => s + r.diasConfinado, 0);
  if (totalDias > 0) {
    gmdMedioPonderado = somaPonderada / totalDias;
  }

  const diasMedio = comGmd.length > 0
    ? comGmd.reduce((s, r) => s + r.diasConfinado, 0) / comGmd.length
    : 0;

  return {
    confinamentoId: confinamento.id,
    confinamento,
    totalAnimais: vínculos.length,
    ativos,
    finalizados,
    estadoDerivado: estado,
    gmdMedioSimples,
    gmdMedioPonderado,
    pesoMedioEntrada,
    pesoMedioSaida,
    diasMedio,
    mortalidade
  };
}
