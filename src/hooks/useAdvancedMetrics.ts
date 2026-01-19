import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { calcularGMDAcumulado } from '../utils/calcularGMD';

/**
 * Hook para métricas e indicadores avançados do dashboard
 */

export interface AdvancedMetrics {
  // Taxa de crescimento
  crescimento: {
    taxaMensal: number; // Percentual de crescimento mensal do rebanho
    projecaoProximoMes: number; // Projeção de nascimentos para o próximo mês
    tendencia: 'crescente' | 'decrescente' | 'estavel';
  };

  // Mortalidade
  mortalidade: {
    taxaGeral: number; // Percentual de mortalidade geral
    taxaUltimos6Meses: number; // Taxa nos últimos 6 meses
    totalMortes: number;
    tendencia: 'aumentando' | 'diminuindo' | 'estavel';
  };

  // Intervalo Parto-Parto
  intervaloParto: {
    mediaDias: number; // Média em dias
    minimo: number;
    maximo: number;
    totalMatrizes: number; // Matrizes com 2+ partos
  };

  // GMD (Ganho Médio Diário)
  gmd: {
    medio: number; // GMD médio do rebanho
    porCategoria: Array<{
      categoria: string;
      gmd: number;
    }>;
    tendencia: 'melhorando' | 'piorando' | 'estavel';
  };

  // Produtividade
  produtividade: {
    nascimentosPorMatriz: number; // Média de nascimentos por matriz
    taxaDesmama: number; // Percentual de nascimentos desmamados
    pesoMedioDesmama: number;
  };

  // Comparativos mês a mês
  comparativoMensal: Array<{
    mes: string;
    ano: number;
    nascimentos: number;
    desmamas: number;
    mortes: number;
    gmdMedio: number;
  }>;

  // Projeções
  projecoes: {
    nascimentosProximo3Meses: number;
    desmamasProximas: number; // Animais próximos da idade de desmama
    vacinasVencendo: number; // Vacinas vencendo em até 30 dias
  };
}

export function useAdvancedMetrics(fazendaId?: string): AdvancedMetrics {
  // Carregar dados
  const nascimentosRaw = useLiveQuery(() => db.nascimentos.toArray(), []) || [];
  const desmamas = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  const pesagens = useLiveQuery(() => db.pesagens.toArray(), []) || [];
  const matrizes = useLiveQuery(() => db.matrizes.toArray(), []) || [];
  const vacinacoes = useLiveQuery(() => db.vacinacoes.toArray(), []) || [];

  // Filtrar por fazenda
  const nascimentos = useMemo(() => {
    if (!fazendaId) return nascimentosRaw;
    return nascimentosRaw.filter(n => n.fazendaId === fazendaId);
  }, [nascimentosRaw, fazendaId]);

  // 1. Taxa de crescimento
  const crescimento = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // Nascimentos dos últimos 6 meses
    const ultimos6Meses: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const data = new Date(anoAtual, mesAtual - i, 1);
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();
      const count = nascimentos.filter(
        n => n.mes === mes && n.ano === ano && !n.morto
      ).length;
      ultimos6Meses.push(count);
    }

    // Calcular taxa mensal (média de crescimento)
    const mediaPrimeiros3 = ultimos6Meses.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const mediaUltimos3 = ultimos6Meses.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
    const taxaMensal = mediaPrimeiros3 > 0
      ? ((mediaUltimos3 - mediaPrimeiros3) / mediaPrimeiros3) * 100
      : 0;

    // Projeção para o próximo mês (média dos últimos 3)
    const projecaoProximoMes = Math.round(mediaUltimos3);

    // Tendência
    let tendencia: 'crescente' | 'decrescente' | 'estavel' = 'estavel';
    if (taxaMensal > 5) tendencia = 'crescente';
    else if (taxaMensal < -5) tendencia = 'decrescente';

    return {
      taxaMensal,
      projecaoProximoMes,
      tendencia
    };
  }, [nascimentos]);

  // 2. Mortalidade
  const mortalidade = useMemo(() => {
    const totalNascimentos = nascimentos.length;
    const totalMortes = nascimentos.filter(n => n.morto).length;
    const taxaGeral = totalNascimentos > 0 ? (totalMortes / totalNascimentos) * 100 : 0;

    // Taxa nos últimos 6 meses
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

    const nascimentosRecentes = nascimentos.filter(n => {
      const data = new Date(n.dataNascimento);
      return data >= seisMesesAtras;
    });

    const mortesRecentes = nascimentosRecentes.filter(n => n.morto).length;
    const taxaUltimos6Meses = nascimentosRecentes.length > 0
      ? (mortesRecentes / nascimentosRecentes.length) * 100
      : 0;

    // Tendência
    let tendencia: 'aumentando' | 'diminuindo' | 'estavel' = 'estavel';
    if (taxaUltimos6Meses > taxaGeral + 2) tendencia = 'aumentando';
    else if (taxaUltimos6Meses < taxaGeral - 2) tendencia = 'diminuindo';

    return {
      taxaGeral,
      taxaUltimos6Meses,
      totalMortes,
      tendencia
    };
  }, [nascimentos]);

  // 3. Intervalo Parto-Parto
  const intervaloParto = useMemo(() => {
    // Agrupar nascimentos por matriz
    const partosPorMatriz = new Map<string, string[]>();
    
    nascimentos.forEach(n => {
      if (!n.matrizId || !n.dataNascimento) return;
      if (!partosPorMatriz.has(n.matrizId)) {
        partosPorMatriz.set(n.matrizId, []);
      }
      partosPorMatriz.get(n.matrizId)!.push(n.dataNascimento);
    });

    // Calcular intervalos
    const intervalos: number[] = [];
    partosPorMatriz.forEach(datas => {
      if (datas.length < 2) return;
      
      // Ordenar datas
      const datasOrdenadas = datas.sort();
      
      // Calcular intervalos entre partos consecutivos
      for (let i = 1; i < datasOrdenadas.length; i++) {
        const data1 = new Date(datasOrdenadas[i - 1]);
        const data2 = new Date(datasOrdenadas[i]);
        const diffDias = Math.floor((data2.getTime() - data1.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 0 && diffDias < 730) { // Intervalo razoável (< 2 anos)
          intervalos.push(diffDias);
        }
      }
    });

    const mediaDias = intervalos.length > 0
      ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length
      : 0;
    const minimo = intervalos.length > 0 ? Math.min(...intervalos) : 0;
    const maximo = intervalos.length > 0 ? Math.max(...intervalos) : 0;
    const totalMatrizes = Array.from(partosPorMatriz.values()).filter(d => d.length >= 2).length;

    return {
      mediaDias,
      minimo,
      maximo,
      totalMatrizes
    };
  }, [nascimentos]);

  // 4. GMD (Ganho Médio Diário)
  const gmd = useMemo(() => {
    const gmds: number[] = [];
    const gmdPorCategoria = new Map<string, number[]>();

    // Calcular GMD para cada animal com pesagens
    nascimentos.forEach(n => {
      const pesagensAnimal = pesagens.filter(p => p.nascimentoId === n.id);
      if (pesagensAnimal.length < 2) return;

      const gmdAnimal = calcularGMDAcumulado(n, pesagensAnimal);
      if (gmdAnimal > 0) {
        gmds.push(gmdAnimal);

        // Por categoria
        const categoria = n.tipo || 'Outros';
        if (!gmdPorCategoria.has(categoria)) {
          gmdPorCategoria.set(categoria, []);
        }
        gmdPorCategoria.get(categoria)!.push(gmdAnimal);
      }
    });

    const medio = gmds.length > 0
      ? gmds.reduce((a, b) => a + b, 0) / gmds.length
      : 0;

    const porCategoria = Array.from(gmdPorCategoria.entries()).map(([categoria, valores]) => ({
      categoria,
      gmd: valores.reduce((a, b) => a + b, 0) / valores.length
    }));

    // Tendência (comparar últimos 3 meses vs anteriores)
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    const gmdsRecentes: number[] = [];
    const gmdsAntigos: number[] = [];

    nascimentos.forEach(n => {
      const dataNasc = new Date(n.dataNascimento);
      const pesagensAnimal = pesagens.filter(p => p.nascimentoId === n.id);
      if (pesagensAnimal.length < 2) return;

      const gmdAnimal = calcularGMDAcumulado(n, pesagensAnimal);
      if (gmdAnimal > 0) {
        if (dataNasc >= tresMesesAtras) {
          gmdsRecentes.push(gmdAnimal);
        } else {
          gmdsAntigos.push(gmdAnimal);
        }
      }
    });

    const mediaRecente = gmdsRecentes.length > 0
      ? gmdsRecentes.reduce((a, b) => a + b, 0) / gmdsRecentes.length
      : 0;
    const mediaAntiga = gmdsAntigos.length > 0
      ? gmdsAntigos.reduce((a, b) => a + b, 0) / gmdsAntigos.length
      : 0;

    let tendencia: 'melhorando' | 'piorando' | 'estavel' = 'estavel';
    if (mediaRecente > mediaAntiga + 0.05) tendencia = 'melhorando';
    else if (mediaRecente < mediaAntiga - 0.05) tendencia = 'piorando';

    return {
      medio,
      porCategoria,
      tendencia
    };
  }, [nascimentos, pesagens]);

  // 5. Produtividade
  const produtividade = useMemo(() => {
    const totalMatrizes = matrizes.filter(m => fazendaId ? m.fazendaId === fazendaId : true).length;
    const nascimentosPorMatriz = totalMatrizes > 0 ? nascimentos.length / totalMatrizes : 0;

    const nascimentosComDesmama = nascimentos.filter(n =>
      desmamas.some(d => d.nascimentoId === n.id)
    ).length;
    const taxaDesmama = nascimentos.length > 0
      ? (nascimentosComDesmama / nascimentos.length) * 100
      : 0;

    const pesosDesmama = desmamas
      .map(d => parseFloat(d.pesoDesmama || '0'))
      .filter(p => p > 0);
    const pesoMedioDesmama = pesosDesmama.length > 0
      ? pesosDesmama.reduce((a, b) => a + b, 0) / pesosDesmama.length
      : 0;

    return {
      nascimentosPorMatriz,
      taxaDesmama,
      pesoMedioDesmama
    };
  }, [nascimentos, desmamas, matrizes, fazendaId]);

  // 6. Comparativo mensal
  const comparativoMensal = useMemo(() => {
    const hoje = new Date();
    const resultado: AdvancedMetrics['comparativoMensal'] = [];

    for (let i = 11; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();

      const nascimentosMes = nascimentos.filter(n => n.mes === mes && n.ano === ano);
      const desmamasMes = desmamas.filter(d => {
        const dataDesmama = new Date(d.dataDesmama);
        return dataDesmama.getMonth() + 1 === mes && dataDesmama.getFullYear() === ano;
      });

      const mortes = nascimentosMes.filter(n => n.morto).length;

      // GMD médio do mês
      const gmdsMes: number[] = [];
      nascimentosMes.forEach(n => {
        const pesagensAnimal = pesagens.filter(p => p.nascimentoId === n.id);
        if (pesagensAnimal.length >= 2) {
          const gmdAnimal = calcularGMDAcumulado(n, pesagensAnimal);
          if (gmdAnimal > 0) gmdsMes.push(gmdAnimal);
        }
      });
      const gmdMedio = gmdsMes.length > 0
        ? gmdsMes.reduce((a, b) => a + b, 0) / gmdsMes.length
        : 0;

      resultado.push({
        mes: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        ano,
        nascimentos: nascimentosMes.length,
        desmamas: desmamasMes.length,
        mortes,
        gmdMedio
      });
    }

    return resultado;
  }, [nascimentos, desmamas, pesagens]);

  // 7. Projeções
  const projecoes = useMemo(() => {
    // Nascimentos próximo 3 meses (baseado na média dos últimos 3)
    const ultimos3 = comparativoMensal.slice(-3);
    const mediaNascimentos = ultimos3.reduce((acc, m) => acc + m.nascimentos, 0) / 3;
    const nascimentosProximo3Meses = Math.round(mediaNascimentos * 3);

    // Animais próximos da idade de desmama (6-8 meses sem desmama)
    const hoje = new Date();
    const seisMesesAtras = new Date(hoje);
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 8);
    const oitoMesesAtras = new Date(hoje);
    oitoMesesAtras.setMonth(oitoMesesAtras.getMonth() - 6);

    const desmamasProximas = nascimentos.filter(n => {
      const dataNasc = new Date(n.dataNascimento);
      const temDesmama = desmamas.some(d => d.nascimentoId === n.id);
      return !temDesmama && dataNasc >= seisMesesAtras && dataNasc <= oitoMesesAtras && !n.morto;
    }).length;

    // Vacinas vencendo em até 30 dias
    const daquiA30Dias = new Date(hoje);
    daquiA30Dias.setDate(daquiA30Dias.getDate() + 30);

    const vacinasVencendo = vacinacoes.filter(v => {
      if (!v.dataVencimento) return false;
      const dataVenc = new Date(v.dataVencimento);
      return dataVenc >= hoje && dataVenc <= daquiA30Dias;
    }).length;

    return {
      nascimentosProximo3Meses,
      desmamasProximas,
      vacinasVencendo
    };
  }, [nascimentos, desmamas, vacinacoes, comparativoMensal]);

  return {
    crescimento,
    mortalidade,
    intervaloParto,
    gmd,
    produtividade,
    comparativoMensal,
    projecoes
  };
}
