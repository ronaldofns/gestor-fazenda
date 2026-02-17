/**
 * Regras de Negócio do Módulo de Confinamento
 *
 * Regras importantes:
 * 1. Animal só pode ter 1 confinamento ativo
 * 2. Encerrar confinamento fecha todos os vínculos ativos
 * 3. Animal vendido/morto encerra vínculo automaticamente
 */

import { db } from "../db/dexieDB";
import { Confinamento, ConfinamentoAnimal } from "../db/models";
import { createSyncEvent } from "./syncEvents";

/**
 * Valida se um animal pode entrar em um confinamento
 * Regra: Animal só pode ter 1 confinamento ativo
 */
export async function validarEntradaAnimal(
  animalId: string,
  confinamentoId: string,
): Promise<{ valido: boolean; erro?: string }> {
  // Verificar se animal já está em outro confinamento ativo
  const vínculosAtivos = await db.confinamentoAnimais
    .where("animalId")
    .equals(animalId)
    .and((v) => v.dataSaida == null && v.deletedAt == null)
    .toArray();

  // Filtrar vínculos do mesmo confinamento (permitir reentrada após saída)
  const outrosConfinamentos = vínculosAtivos.filter(
    (v) => v.confinamentoId !== confinamentoId,
  );

  if (outrosConfinamentos.length > 0) {
    const confinamento = await db.confinamentos.get(
      outrosConfinamentos[0].confinamentoId,
    );
    return {
      valido: false,
      erro: `Animal já está confinado em: ${confinamento?.nome || "Confinamento desconhecido"}`,
    };
  }

  return { valido: true };
}

/**
 * Encerra um confinamento
 * Regra: Quando data_fim_real for preenchida, todos os vínculos ativos devem ser encerrados
 */
export async function encerrarConfinamento(
  confinamentoId: string,
  dataFimReal: string,
  pesoPadraoSaida?: number,
): Promise<{ sucesso: boolean; erro?: string; animaisEncerrados: number }> {
  try {
    const confinamento = await db.confinamentos.get(confinamentoId);
    if (!confinamento) {
      return {
        sucesso: false,
        erro: "Confinamento não encontrado",
        animaisEncerrados: 0,
      };
    }

    // Buscar todos os vínculos ativos
    const vínculosAtivos = await db.confinamentoAnimais
      .where("confinamentoId")
      .equals(confinamentoId)
      .and((v) => v.dataSaida == null && v.deletedAt == null)
      .toArray();

    let animaisEncerrados = 0;

    // Encerrar cada vínculo
    for (const vínculo of vínculosAtivos) {
      const updates: Partial<ConfinamentoAnimal> = {
        dataSaida: dataFimReal,
        observacoes: vínculo.observacoes
          ? `${vínculo.observacoes}\n[Encerramento automático do confinamento]`
          : "[Encerramento automático do confinamento]",
        updatedAt: new Date().toISOString(),
      };

      if (!vínculo.pesoSaida) {
        // 1) Última pesagem do confinamento deste animal (mais fiel à saída)
        // Buscar última pesagem do animal (tabela geral `pesagens`) ao invés de `confinamentoPesagens`
        const pesagens = await db.pesagens
          .where("animalId")
          .equals(vínculo.animalId)
          .and((p) => p.deletedAt == null)
          .toArray();
        const ultimaPesagem =
          pesagens.length > 0
            ? pesagens.sort(
                (a, b) =>
                  new Date(b.dataPesagem).getTime() -
                  new Date(a.dataPesagem).getTime(),
              )[0]
            : null;
        if (ultimaPesagem?.peso) {
          updates.pesoSaida = ultimaPesagem.peso;
        } else {
          // 2) Peso atual do animal no cadastro
          const animal = await db.animais.get(vínculo.animalId);
          if (animal?.pesoAtual) {
            updates.pesoSaida = animal.pesoAtual;
          } else {
            // 3) Fallback: peso padrão informado ou peso de entrada
            updates.pesoSaida = pesoPadraoSaida ?? vínculo.pesoEntrada;
          }
        }
      }

      await db.confinamentoAnimais.update(vínculo.id, updates);
      animaisEncerrados++;

      // Criar evento de sincronização
      const vínculoAtualizado = await db.confinamentoAnimais.get(vínculo.id);
      if (vínculoAtualizado) {
        await createSyncEvent(
          "UPDATE",
          "confinamentoAnimal",
          vínculo.id,
          vínculoAtualizado,
        );
      }
    }

    // Atualizar confinamento
    await db.confinamentos.update(confinamentoId, {
      status: "finalizado",
      dataFimReal: dataFimReal,
      updatedAt: new Date().toISOString(),
    });

    const confinamentoAtualizado = await db.confinamentos.get(confinamentoId);
    if (confinamentoAtualizado) {
      await createSyncEvent(
        "UPDATE",
        "confinamento",
        confinamentoId,
        confinamentoAtualizado,
      );
    }

    return { sucesso: true, animaisEncerrados };
  } catch (error: any) {
    console.error("Erro ao encerrar confinamento:", error);
    return {
      sucesso: false,
      erro: error.message || "Erro desconhecido",
      animaisEncerrados: 0,
    };
  }
}

/**
 * Encerra vínculo de confinamento quando animal é vendido/morto
 * Regra: Animal vendido/morto deve ter vínculo encerrado automaticamente
 */
export async function encerrarVinculoPorStatusAnimal(
  animalId: string,
  motivoSaida: "abate" | "venda" | "morte" | "outro",
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    // Buscar vínculo ativo
    const vínculosAtivos = await db.confinamentoAnimais
      .where("animalId")
      .equals(animalId)
      .and((v) => v.dataSaida == null && v.deletedAt == null)
      .toArray();

    if (vínculosAtivos.length === 0) {
      return { sucesso: true }; // Nenhum vínculo ativo, nada a fazer
    }

    const hoje = new Date().toISOString().split("T")[0];

    for (const vínculo of vínculosAtivos) {
      // Buscar último peso do animal (se disponível)
      const pesagens = await db.pesagens
        .where("animalId")
        .equals(animalId)
        .and((p) => p.deletedAt == null)
        .sortBy("dataPesagem");

      const ultimoPeso =
        pesagens.length > 0
          ? pesagens[pesagens.length - 1].peso
          : vínculo.pesoEntrada;

      await db.confinamentoAnimais.update(vínculo.id, {
        dataSaida: hoje,
        pesoSaida: ultimoPeso,
        motivoSaida: motivoSaida,
        observacoes: vínculo.observacoes
          ? `${vínculo.observacoes}\n[Encerramento automático: ${motivoSaida}]`
          : `[Encerramento automático: ${motivoSaida}]`,
        updatedAt: new Date().toISOString(),
      });

      // Criar evento de sincronização
      const vínculoAtualizado = await db.confinamentoAnimais.get(vínculo.id);
      if (vínculoAtualizado) {
        await createSyncEvent(
          "UPDATE",
          "confinamentoAnimal",
          vínculo.id,
          vínculoAtualizado,
        );
      }
    }

    return { sucesso: true };
  } catch (error: any) {
    console.error("Erro ao encerrar vínculo por status do animal:", error);
    return { sucesso: false, erro: error.message || "Erro desconhecido" };
  }
}

/**
 * Calcula GMD (Ganho Médio Diário) para um vínculo animal-confinamento
 */
export function calcularGMD(
  pesoEntrada: number,
  pesoSaida: number | undefined,
  dataEntrada: string,
  dataSaida: string | undefined,
): { gmd: number | null; dias: number } {
  if (!pesoSaida || !dataSaida) {
    return { gmd: null, dias: 0 };
  }

  const entrada = new Date(dataEntrada);
  const saida = new Date(dataSaida);
  const dias = Math.max(
    1,
    Math.floor((saida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const ganhoTotal = pesoSaida - pesoEntrada;
  const gmd = ganhoTotal / dias;

  return { gmd, dias };
}

/**
 * Calcula GMD parcial (até hoje) para um vínculo ativo
 */
export function calcularGMDParcial(
  pesoEntrada: number,
  pesoAtual: number | undefined,
  dataEntrada: string,
): { gmd: number | null; dias: number } {
  if (!pesoAtual) {
    return { gmd: null, dias: 0 };
  }

  const entrada = new Date(dataEntrada);
  const hoje = new Date();
  const dias = Math.max(
    1,
    Math.floor((hoje.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const ganhoTotal = pesoAtual - pesoEntrada;
  const gmd = ganhoTotal / dias;

  return { gmd, dias };
}

/**
 * Valida dados antes de criar/atualizar confinamento
 */
export function validarConfinamento(confinamento: Partial<Confinamento>): {
  valido: boolean;
  erro?: string;
} {
  if (!confinamento.nome || confinamento.nome.trim().length === 0) {
    return { valido: false, erro: "Nome do confinamento é obrigatório" };
  }

  if (!confinamento.dataInicio) {
    return { valido: false, erro: "Data de início é obrigatória" };
  }

  if (confinamento.dataFimPrevista && confinamento.dataFimReal) {
    const inicio = new Date(confinamento.dataInicio);
    const fimReal = new Date(confinamento.dataFimReal);
    if (fimReal < inicio) {
      return {
        valido: false,
        erro: "Data de fim real não pode ser anterior à data de início",
      };
    }
  }

  if (
    confinamento.status &&
    !["ativo", "finalizado", "cancelado"].includes(confinamento.status)
  ) {
    return { valido: false, erro: "Status inválido" };
  }

  return { valido: true };
}

/**
 * Valida dados antes de criar/atualizar vínculo animal-confinamento
 */
export function validarConfinamentoAnimal(
  vínculo: Partial<ConfinamentoAnimal>,
): { valido: boolean; erro?: string } {
  if (!vínculo.confinamentoId) {
    return { valido: false, erro: "Confinamento é obrigatório" };
  }

  if (!vínculo.animalId) {
    return { valido: false, erro: "Animal é obrigatório" };
  }

  if (!vínculo.dataEntrada) {
    return { valido: false, erro: "Data de entrada é obrigatória" };
  }

  if (vínculo.pesoEntrada && vínculo.pesoEntrada <= 0) {
    return { valido: false, erro: "Peso de entrada deve ser maior que zero" };
  }

  if (vínculo.pesoSaida && vínculo.pesoSaida <= 0) {
    return { valido: false, erro: "Peso de saída deve ser maior que zero" };
  }

  if (vínculo.dataSaida && vínculo.dataEntrada) {
    const entrada = new Date(vínculo.dataEntrada);
    const saida = new Date(vínculo.dataSaida);
    if (saida < entrada) {
      return {
        valido: false,
        erro: "Data de saída não pode ser anterior à data de entrada",
      };
    }
  }

  if (
    vínculo.motivoSaida &&
    !["abate", "venda", "morte", "outro"].includes(vínculo.motivoSaida)
  ) {
    return { valido: false, erro: "Motivo de saída inválido" };
  }

  return { valido: true };
}
