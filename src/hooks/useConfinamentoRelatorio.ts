/**
 * Dados agregados para o relatório de confinamento (tela e exportação).
 */

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { calcularGMD, calcularGMDParcial } from "../utils/confinamentoRules";
import { estadoConfinamentoDerivado } from "../utils/confinamentoEstado";
import type { DadosConfinamentoExportacao } from "../utils/exportarConfinamento";

const ARROBA_KG = 15;

export function useConfinamentoRelatorio(fazendaId?: string | null) {
  const dados =
    useLiveQuery(async (): Promise<DadosConfinamentoExportacao | null> => {
      const confinamentos = await db.confinamentos
        .filter(
          (c) => !c.deletedAt && (!fazendaId || c.fazendaId === fazendaId),
        )
        .toArray();

      const fazendas = await db.fazendas.toArray();
      const fazendasMap = new Map(fazendas.map((f) => [f.id, f.nome]));
      const animais = await db.animais.toArray();
      const animaisMap = new Map(animais.map((a) => [a.id, a]));

      const porConfinamento: DadosConfinamentoExportacao["porConfinamento"] =
        [];
      let custoTotalGeral = 0;
      let mortalidadeTotal = 0;
      let arrobasGeral = 0;
      const gmdList: number[] = [];

      for (const conf of confinamentos) {
        const vinculos = await db.confinamentoAnimais
          .where("confinamentoId")
          .equals(conf.id)
          .and((v) => v.deletedAt == null)
          .toArray();

        const alimentacao = await db.confinamentoAlimentacao
          .where("confinamentoId")
          .equals(conf.id)
          .and((a) => a.deletedAt == null)
          .toArray();

        const custoTotal = alimentacao.reduce(
          (s, a) => s + (a.custoTotal ?? 0),
          0,
        );
        custoTotalGeral += custoTotal;

        const mortes = vinculos.filter((v) => v.motivoSaida === "morte").length;
        mortalidadeTotal += mortes;

        let pesoMedioEntrada = 0;
        const gmdPorVinculo: number[] = [];
        let kgGanhoTotal = 0;
        const diasList: number[] = [];

        if (vinculos.length > 0) {
          pesoMedioEntrada =
            vinculos.reduce((s, v) => s + (v.pesoEntrada ?? 0), 0) /
            vinculos.length;
          const pesagensRaw = await db.pesagens.toArray();

          for (const v of vinculos) {
            if (v.dataSaida && v.pesoSaida != null) {
              const res = calcularGMD(
                v.pesoEntrada,
                v.pesoSaida,
                v.dataEntrada,
                v.dataSaida,
              );
              if (res.gmd != null) {
                gmdPorVinculo.push(res.gmd);
                gmdList.push(res.gmd);
                diasList.push(res.dias);
              }
              kgGanhoTotal += (v.pesoSaida ?? 0) - (v.pesoEntrada ?? 0);
            } else {
              const pesagensV = pesagensRaw.filter(
                (p) => p.animalId === v.animalId && !p.deletedAt,
              );
              const ultima =
                pesagensV.length > 0
                  ? pesagensV.sort(
                      (a, b) =>
                        new Date(b.dataPesagem).getTime() -
                        new Date(a.dataPesagem).getTime(),
                    )[0]
                  : null;
              const pesoAtual =
                ultima?.peso ?? animaisMap.get(v.animalId)?.pesoAtual;
              if (pesoAtual != null) {
                const res = calcularGMDParcial(
                  v.pesoEntrada,
                  pesoAtual,
                  v.dataEntrada,
                );
                if (res.gmd != null) {
                  gmdPorVinculo.push(res.gmd);
                  gmdList.push(res.gmd);
                }
              }
            }
          }
        }

        const gmdMedio =
          gmdPorVinculo.length > 0
            ? gmdPorVinculo.reduce((a, b) => a + b, 0) / gmdPorVinculo.length
            : 0;

        const arrobas = kgGanhoTotal / ARROBA_KG;
        arrobasGeral += arrobas;
        const custoPorArroba = arrobas > 0 ? custoTotal / arrobas : null;
        const diasMedio =
          diasList.length > 0
            ? diasList.reduce((a, b) => a + b, 0) / diasList.length
            : 0;

        const statusDerivado = estadoConfinamentoDerivado(conf, vinculos);
        porConfinamento.push({
          nome: conf.nome,
          fazenda: fazendasMap.get(conf.fazendaId) ?? "N/A",
          status: statusDerivado,
          totalAnimais: vinculos.length,
          pesoMedioEntrada,
          gmdMedio,
          custoTotal,
          arrobas,
          custoPorArroba,
          mortes,
          diasMedio,
        });
      }

      const totalAnimais = porConfinamento.reduce(
        (s, c) => s + c.totalAnimais,
        0,
      );
      const gmdMedioGeral =
        gmdList.length > 0
          ? gmdList.reduce((a, b) => a + b, 0) / gmdList.length
          : 0;
      const custoPorArrobaGeral =
        arrobasGeral > 0 ? custoTotalGeral / arrobasGeral : null;

      const ativosDerivado = porConfinamento.filter(
        (c) => c.status === "ativo",
      ).length;
      return {
        resumo: {
          totalConfinamentos: confinamentos.length,
          ativos: ativosDerivado,
          totalAnimais,
          gmdMedioGeral,
          custoTotalGeral,
          mortalidade: mortalidadeTotal,
          arrobasProducao: arrobasGeral,
          custoPorArroba: custoPorArrobaGeral,
        },
        porConfinamento,
      };
    }, [fazendaId]);

  return dados ?? null;
}
