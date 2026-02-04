import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';

/** Converte string de data (dd/mm/yyyy ou yyyy-mm-dd) para Date. Evita erro com formato BR. */
function parseDataBR(val: string | null | undefined): Date | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  const s = val.trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      const date = new Date(iso);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(s);
  return isNaN(date.getTime()) ? null : date;
}

interface RebanhoMetrics {
  // Totais gerais
  totalAnimais: number;
  totalVivos: number;
  totalMortos: number;
  variacaoMes: number;
  
  // Distribuição por sexo (apenas bezerros)
  femeas: number;
  machos: number;
  bezerrasFemeas: number; // Apenas bezerras
  bezerrosMachos: number; // Apenas bezerros machos
  percentualFemeas: number;
  percentualMachos: number;
  percentualBezerrasFemeas: number;
  percentualBezerrosMachos: number;
  
  // Distribuição por tipo
  distribuicaoPorTipo: Map<string, number>;
  tiposOrdenados: Array<{ tipo: string; total: number; percentual: number }>;
  
  // Matrizes
  totalMatrizes: number;
  matrizesAtivas: number;
  percentualMatrizes: number;
  
  // Por fazenda (separado por categorias)
  distribuicaoPorFazenda: Array<{
    fazendaId: string;
    nome: string;
    total: number;
    vivos: number;
    mortos: number;
    vacas: number;
    bezerros: number;
    novilhas: number;
    outros: number;
    percentual: number;
  }>;
  
  // Evolução temporal (últimos 12 meses)
  evolucaoRebanho: Array<{
    mes: string;
    total: number;
    nascimentos: number; // Apenas bezerros nascidos
    mortes: number;
  }>;
  
  // Taxa de mortalidade
  taxaMortalidade: number;
  taxaMortalidadeMes: number;
  
  // Métricas de Produtividade (Fase 2)
  gmdMedio: number; // GMD médio do rebanho (kg/dia)
  gmdPorCategoria: Array<{ categoria: string; gmd: number }>; // GMD por tipo de animal
  iepMedio: number; // IEP médio em dias
  taxaDesmama: number; // Taxa de desmama (%)
  totalDesmamas: number; // Total de desmamas registradas
  totalNascimentos: number; // Total de nascimentos (para calcular taxa de desmama)
  
  // Fase 4: Análise Avançada
  comparativoMes: {
    totalAtual: number;
    totalAnterior: number;
    variacao: number;
    variacaoPercentual: number;
    nascimentosAtual: number;
    nascimentosAnterior: number;
    mortesAtual: number;
    mortesAnterior: number;
  };
  comparativoAno: {
    totalAtual: number;
    totalAnterior: number;
    variacao: number;
    variacaoPercentual: number;
    nascimentosAtual: number;
    nascimentosAnterior: number;
    mortesAtual: number;
    mortesAnterior: number;
  };
  tendenciaRebanho: 'crescimento' | 'estavel' | 'queda';
  tendenciaPercentual: number; // Variação % últimos 3 meses vs 3 anteriores
  benchmarkingFazendas: Array<{
    fazendaId: string;
    nome: string;
    total: number;
    nascimentos12m: number;
    mortes12m: number;
    gmdMedio: number;
    taxaDesmama: number;
  }>;
  
  // Status
  isLoading: boolean;
}

export interface FiltrosDashboard {
  /** Últimos N meses na evolução (3, 6 ou 12). Default 12. */
  periodoMeses?: 3 | 6 | 12;
  /** Filtrar por tipos de animal (tipoId). Vazio = todos. */
  tipoIds?: string[];
  /** Filtrar por status (statusId). Vazio = todos. */
  statusIds?: string[];
}

export function useRebanhoMetrics(fazendaId?: string, filtros?: FiltrosDashboard): RebanhoMetrics {
  // Carregar dados
  const animaisRaw = useLiveQuery(() => db.animais.toArray(), []) || [];
  const tiposRaw = useLiveQuery(() => db.tiposAnimal.filter(t => !t.deletedAt).toArray(), []) || [];
  const statusRaw = useLiveQuery(() => db.statusAnimal.filter(s => !s.deletedAt).toArray(), []) || [];
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const genealogiasRaw = useLiveQuery(() => db.genealogias.toArray(), []) || [];
  const pesagensRaw = useLiveQuery(() => db.pesagens.toArray(), []) || [];
  const desmamasRaw = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  
  const isLoading = animaisRaw === undefined;
  const periodoMeses = filtros?.periodoMeses ?? 12;
  const tipoIdsSet = filtros?.tipoIds?.length ? new Set(filtros.tipoIds) : null;
  const statusIdsSet = filtros?.statusIds?.length ? new Set(filtros.statusIds) : null;
  
  // Mapas auxiliares
  const tipoMap = useMemo(() => {
    const map = new Map<string, string>();
    tiposRaw.forEach(t => {
      if (t.id) map.set(t.id, t.nome || 'Sem tipo');
    });
    return map;
  }, [tiposRaw]);
  
  const statusMap = useMemo(() => {
    const map = new Map<string, string>();
    statusRaw.forEach(s => {
      if (s.id) map.set(s.id, s.nome || 'Desconhecido');
    });
    return map;
  }, [statusRaw]);
  
  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendasRaw.forEach(f => {
      if (f.id) map.set(f.id, f.nome || 'Sem fazenda');
    });
    return map;
  }, [fazendasRaw]);
  
  // Set de matrizes (animais que têm filhos)
  const matrizesSet = useMemo(() => {
    const set = new Set<string>();
    genealogiasRaw.forEach(g => {
      if (g.matrizId) set.add(g.matrizId);
    });
    return set;
  }, [genealogiasRaw]);
  
  const metrics = useMemo(() => {
    // Filtrar por fazenda se especificado
    let animais = animaisRaw.filter(a => !a.deletedAt);
    if (fazendaId) {
      animais = animais.filter(a => a.fazendaId === fazendaId);
    }
    // Filtros: por tipo e status (conforme PROPOSTA_DASHBOARD_MODERNA)
    if (tipoIdsSet) {
      animais = animais.filter(a => a.tipoId && tipoIdsSet.has(a.tipoId));
    }
    if (statusIdsSet) {
      animais = animais.filter(a => a.statusId && statusIdsSet.has(a.statusId));
    }
    
    // Totais gerais
    const totalAnimais = animais.length;
    const totalVivos = animais.filter(a => {
      const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
      return statusNome !== 'morto' && statusNome !== 'vendido';
    }).length;
    const totalMortos = animais.filter(a => {
      const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
      return statusNome === 'morto';
    }).length;
    
    // Calcular variação do mês USANDO DATA DE NASCIMENTO
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const animaisNascidosNoMes = animais.filter(a => {
      const dataNascimento = parseDataBR(a.dataNascimento);
      return dataNascimento && dataNascimento >= inicioMes && dataNascimento <= agora;
    }).length;
    const mortosNoMes = animais.filter(a => {
      const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
      if (statusNome !== 'morto') return false;
      // Verificar dataSaida para mortes (mais preciso)
      const dataMorte = parseDataBR(a.dataSaida) ?? (a.updatedAt ? new Date(a.updatedAt) : null);
      return dataMorte && dataMorte >= inicioMes && dataMorte <= agora;
    }).length;
    const variacaoMes = animaisNascidosNoMes - mortosNoMes;
    
    // Distribuição por sexo
    const femeas = animais.filter(a => a.sexo === 'F').length;
    const machos = animais.filter(a => a.sexo === 'M').length;
    const percentualFemeas = totalAnimais > 0 ? (femeas / totalAnimais) * 100 : 0;
    const percentualMachos = totalAnimais > 0 ? (machos / totalAnimais) * 100 : 0;
    
    // Distribuição por sexo - APENAS BEZERROS
    const bezerros = animais.filter(a => {
      const tipoNome = a.tipoId ? (tipoMap.get(a.tipoId) || '').toLowerCase() : '';
      return tipoNome.includes('bezerr');
    });
    const bezerrasFemeas = bezerros.filter(a => a.sexo === 'F').length;
    const bezerrosMachos = bezerros.filter(a => a.sexo === 'M').length;
    const totalBezerros = bezerros.length;
    const percentualBezerrasFemeas = totalBezerros > 0 ? (bezerrasFemeas / totalBezerros) * 100 : 0;
    const percentualBezerrosMachos = totalBezerros > 0 ? (bezerrosMachos / totalBezerros) * 100 : 0;
    
    // Distribuição por tipo
    const distribuicaoPorTipo = new Map<string, number>();
    animais.forEach(a => {
      const tipoNome = a.tipoId ? (tipoMap.get(a.tipoId) || 'Sem tipo') : 'Sem tipo';
      distribuicaoPorTipo.set(tipoNome, (distribuicaoPorTipo.get(tipoNome) || 0) + 1);
    });
    
    const tiposOrdenados = Array.from(distribuicaoPorTipo.entries())
      .map(([tipo, total]) => ({
        tipo,
        total,
        percentual: totalAnimais > 0 ? (total / totalAnimais) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
    
    // Matrizes: fêmeas que (1) têm filho na genealogia OU (2) têm tipo Matriz/Vaca (cadastro)
    const totalMatrizes = animais.filter(a => {
      if (a.sexo !== 'F') return false;
      if (matrizesSet.has(a.id)) return true; // já é mãe de algum animal
      const tipoNome = (a.tipoId ? tipoMap.get(a.tipoId) || '' : '').toLowerCase();
      return tipoNome.includes('matriz') || tipoNome.includes('vaca');
    }).length;
    const matrizesAtivas = totalMatrizes; // Todas as matrizes no set são consideradas ativas
    const percentualMatrizes = femeas > 0 ? (totalMatrizes / femeas) * 100 : 0;
    
    // Por fazenda - SEPARADO POR CATEGORIAS
    const fazendaStats = new Map<string, {
      total: number;
      vivos: number;
      mortos: number;
      vacas: number;
      bezerros: number;
      novilhas: number;
      outros: number;
    }>();
    
    animais.forEach(a => {
      const fId = a.fazendaId || 'sem-fazenda';
      const stats = fazendaStats.get(fId) || { 
        total: 0, 
        vivos: 0, 
        mortos: 0, 
        vacas: 0, 
        bezerros: 0, 
        novilhas: 0, 
        outros: 0 
      };
      
      stats.total += 1;
      const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
      if (statusNome === 'morto') stats.mortos += 1;
      else stats.vivos += 1;
      
      // Categorizar por tipo (baseado no nome do tipo)
      const tipoNome = a.tipoId ? (tipoMap.get(a.tipoId) || '').toLowerCase() : '';
      
      if (tipoNome.includes('vaca')) {
        stats.vacas += 1;
      } else if (tipoNome.includes('bezerr')) {
        stats.bezerros += 1;
      } else if (tipoNome.includes('novilh')) {
        stats.novilhas += 1;
      } else {
        stats.outros += 1;
      }
      
      fazendaStats.set(fId, stats);
    });
    
    const distribuicaoPorFazenda = Array.from(fazendaStats.entries())
      .map(([fazendaId, stats]) => ({
        fazendaId,
        nome: fazendaMap.get(fazendaId) || 'Sem fazenda',
        ...stats,
        percentual: totalAnimais > 0 ? (stats.total / totalAnimais) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
    
    // Evolução temporal (últimos N meses conforme filtro) - APENAS BEZERROS NASCIDOS
    const evolucaoRebanho: Array<{ mes: string; total: number; nascimentos: number; mortes: number }> = [];
    const numMeses = Math.max(1, Math.min(12, periodoMeses));
    
    for (let i = numMeses - 1; i >= 0; i--) {
      const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mesProximo = new Date(data.getFullYear(), data.getMonth() + 1, 1);
      const mesLabel = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      // Contar APENAS BEZERROS nascidos neste mês (USAR DATA DE NASCIMENTO)
      const nascimentosNoMes = animais.filter(a => {
        const dataNascimento = parseDataBR(a.dataNascimento);
        if (!dataNascimento || dataNascimento < data || dataNascimento >= mesProximo) return false;
        
        // Verificar se é bezerro
        const tipoNome = a.tipoId ? (tipoMap.get(a.tipoId) || '').toLowerCase() : '';
        return tipoNome.includes('bezerr');
      }).length;
      
      // Contar mortes neste mês
      const mortesNoMes = animais.filter(a => {
        const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
        if (statusNome !== 'morto') return false;
        const dataMorte = parseDataBR(a.dataSaida) ?? (a.updatedAt ? new Date(a.updatedAt) : null);
        return dataMorte && dataMorte >= data && dataMorte < mesProximo;
      }).length;
      
      // Total acumulado até este mês: apenas animais com DATA DE NASCIMENTO (nunca data de cadastro)
      const totalAteMes = animais.filter(a => {
        const dataNascimento = parseDataBR(a.dataNascimento);
        if (!dataNascimento || dataNascimento >= mesProximo) return false;
        const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
        return statusNome !== 'morto';
      }).length;
      
      evolucaoRebanho.push({
        mes: mesLabel,
        total: totalAteMes,
        nascimentos: nascimentosNoMes,
        mortes: mortesNoMes
      });
    }
    
    // Taxa de mortalidade
    const taxaMortalidade = totalAnimais > 0 ? (totalMortos / totalAnimais) * 100 : 0;
    const taxaMortalidadeMes = animaisNascidosNoMes > 0 ? (mortosNoMes / animaisNascidosNoMes) * 100 : 0;
    
    // ========================================
    // FASE 2: MÉTRICAS DE PRODUTIVIDADE
    // ========================================
    
    // 1. GMD (Ganho Médio Diário)
    // Calculado com base nas pesagens de cada animal
    const gmdCalculos: { [animalId: string]: { gmd: number; tipoId: string } } = {};
    
    animais.forEach(animal => {
      // Buscar pesagens do animal (usando nascimentoId que é o mesmo que animalId)
      const pesagensAnimal = pesagensRaw.filter(p => p.nascimentoId === animal.id || p.animalId === animal.id);
      
      if (pesagensAnimal.length >= 2) {
        // Ordenar pesagens por data
        const pesagensOrdenadas = pesagensAnimal.sort((a, b) => {
          const dataA = new Date(a.dataPesagem.includes('/') ? a.dataPesagem.split('/').reverse().join('-') : a.dataPesagem);
          const dataB = new Date(b.dataPesagem.includes('/') ? b.dataPesagem.split('/').reverse().join('-') : b.dataPesagem);
          return dataA.getTime() - dataB.getTime();
        });
        
        // Pegar primeira e última pesagem
        const primeira = pesagensOrdenadas[0];
        const ultima = pesagensOrdenadas[pesagensOrdenadas.length - 1];
        
        const dataPrimeira = new Date(primeira.dataPesagem.includes('/') ? primeira.dataPesagem.split('/').reverse().join('-') : primeira.dataPesagem);
        const dataUltima = new Date(ultima.dataPesagem.includes('/') ? ultima.dataPesagem.split('/').reverse().join('-') : ultima.dataPesagem);
        
        const diasEntre = Math.floor((dataUltima.getTime() - dataPrimeira.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diasEntre > 0) {
          const ganhoPeso = ultima.peso - primeira.peso;
          const gmd = ganhoPeso / diasEntre;
          gmdCalculos[animal.id] = { gmd, tipoId: animal.tipoId };
        }
      }
    });
    
    // GMD médio geral
    const gmds = Object.values(gmdCalculos).map(c => c.gmd);
    const gmdMedio = gmds.length > 0 ? gmds.reduce((a, b) => a + b, 0) / gmds.length : 0;
    
    // GMD por categoria
    const gmdPorTipoMap = new Map<string, number[]>();
    Object.values(gmdCalculos).forEach(calc => {
      const tipoNome = tipoMap.get(calc.tipoId) || 'Sem tipo';
      if (!gmdPorTipoMap.has(tipoNome)) {
        gmdPorTipoMap.set(tipoNome, []);
      }
      gmdPorTipoMap.get(tipoNome)!.push(calc.gmd);
    });
    
    const gmdPorCategoria = Array.from(gmdPorTipoMap.entries()).map(([categoria, valores]) => ({
      categoria,
      gmd: valores.reduce((a, b) => a + b, 0) / valores.length
    }));
    
    // 2. IEP (Intervalo Entre Partos)
    // Calculado com base nos nascimentos de cada matriz
    const iepCalculos: number[] = [];
    const matrizesComFilhos = new Map<string, Date[]>(); // matrizId -> [datas de nascimento]
    
    genealogiasRaw.forEach(gen => {
      if (gen.matrizId && gen.animalId) {
        const animal = animais.find(a => a.id === gen.animalId);
        const dataNasc = animal ? parseDataBR(animal.dataNascimento) : null;
        if (animal && dataNasc) {
          if (!matrizesComFilhos.has(gen.matrizId)) {
            matrizesComFilhos.set(gen.matrizId, []);
          }
          matrizesComFilhos.get(gen.matrizId)!.push(dataNasc);
        }
      }
    });
    
    // Calcular IEP para cada matriz com pelo menos 2 partos
    matrizesComFilhos.forEach((datas, matrizId) => {
      if (datas.length >= 2) {
        // Ordenar datas
        const datasOrdenadas = datas.sort((a, b) => a.getTime() - b.getTime());
        
        // Calcular intervalo entre partos consecutivos
        for (let i = 1; i < datasOrdenadas.length; i++) {
          const diasEntre = Math.floor((datasOrdenadas[i].getTime() - datasOrdenadas[i-1].getTime()) / (1000 * 60 * 60 * 24));
          iepCalculos.push(diasEntre);
        }
      }
    });
    
    const iepMedio = iepCalculos.length > 0 ? iepCalculos.reduce((a, b) => a + b, 0) / iepCalculos.length : 0;
    
    // 3. Taxa de Desmama
    // Total de desmamas / Total de filhos nascidos * 100
    // IMPORTANTE: Contar apenas animais que são filhos (aparecem na genealogia como animalId)
    // ou seja, animais que NÃO são matrizes
    const totalDesmamas = desmamasRaw.length;
    
    // Contar apenas filhos (animais que têm entrada na genealogia como filhos)
    const filhosSet = new Set(genealogiasRaw.map(g => g.animalId).filter(Boolean));
    const totalNascimentos = animais.filter(a => filhosSet.has(a.id)).length;
    
    const taxaDesmama = totalNascimentos > 0 ? (totalDesmamas / totalNascimentos) * 100 : 0;
    
    // ========================================
    // FASE 4: ANÁLISE AVANÇADA
    // ========================================
    
    // Total atual para comparativo: apenas animais com DATA DE NASCIMENTO e vivos (nunca data de cadastro)
    const totalVivosComDataNascimento = animais.filter(a => {
      if (!parseDataBR(a.dataNascimento)) return false;
      const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
      return statusNome !== 'morto';
    }).length;

    // Comparativo mês atual vs mês anterior (índice último = atual, penúltimo = anterior)
    const mesAtual = evolucaoRebanho[numMeses - 1];
    const mesAnterior = numMeses >= 2 ? evolucaoRebanho[numMeses - 2] : null;
    const comparativoMes = {
      totalAtual: mesAtual?.total ?? totalVivosComDataNascimento,
      totalAnterior: mesAnterior?.total ?? 0,
      variacao: (mesAtual?.total ?? totalAnimais) - (mesAnterior?.total ?? 0),
      variacaoPercentual: (mesAnterior?.total ?? 0) > 0
        ? ((((mesAtual?.total ?? totalAnimais) - (mesAnterior?.total ?? 0)) / (mesAnterior?.total ?? 0)) * 100)
        : 0,
      nascimentosAtual: mesAtual?.nascimentos ?? 0,
      nascimentosAnterior: mesAnterior?.nascimentos ?? 0,
      mortesAtual: mesAtual?.mortes ?? 0,
      mortesAnterior: mesAnterior?.mortes ?? 0
    };
    
    // Comparativo ano: total atual (por data nascimento) vs total de 12 meses atrás (evolucaoRebanho[0])
    const anoPassado = evolucaoRebanho[0];
    const totalAnoPassado = anoPassado?.total ?? 0;
    const comparativoAno = {
      totalAtual: totalVivosComDataNascimento,
      totalAnterior: totalAnoPassado,
      variacao: totalVivosComDataNascimento - totalAnoPassado,
      variacaoPercentual: totalAnoPassado > 0 ? (((totalVivosComDataNascimento - totalAnoPassado) / totalAnoPassado) * 100) : 0,
      nascimentosAtual: evolucaoRebanho.slice(0, 12).reduce((s, m) => s + (m?.nascimentos ?? 0), 0),
      nascimentosAnterior: 0, // não temos 24 meses
      mortesAtual: evolucaoRebanho.slice(0, 12).reduce((s, m) => s + (m?.mortes ?? 0), 0),
      mortesAnterior: 0
    };
    
    // Tendência: últimos 3 meses vs 3 meses anteriores (índices 9,10,11 vs 6,7,8)
    const totalUltimos3 = (evolucaoRebanho[9]?.total ?? 0) + (evolucaoRebanho[10]?.total ?? 0) + (evolucaoRebanho[11]?.total ?? 0);
    const total3Anteriores = (evolucaoRebanho[6]?.total ?? 0) + (evolucaoRebanho[7]?.total ?? 0) + (evolucaoRebanho[8]?.total ?? 0);
    const tendenciaPercentual = total3Anteriores > 0 ? (((totalUltimos3 - total3Anteriores) / total3Anteriores) * 100) : 0;
    const tendenciaRebanho: 'crescimento' | 'estavel' | 'queda' =
      tendenciaPercentual > 2 ? 'crescimento' : tendenciaPercentual < -2 ? 'queda' : 'estavel';
    
    // Benchmarking entre fazendas: por cada fazenda, total, nascimentos 12m, mortes 12m, GMD médio, taxa desmama
    const benchmarkingFazendas: Array<{
      fazendaId: string;
      nome: string;
      total: number;
      nascimentos12m: number;
      mortes12m: number;
      gmdMedio: number;
      taxaDesmama: number;
    }> = [];
    
    const fazendaIds = Array.from(fazendaStats.keys());
    fazendaIds.forEach(fId => {
      const animaisFazenda = animais.filter(a => a.fazendaId === fId);
      const totalF = animaisFazenda.length;
      
      const inicio12m = new Date(agora.getFullYear(), agora.getMonth() - 12, 1);
      const nascimentos12m = animaisFazenda.filter(a => {
        const tipoNome = a.tipoId ? (tipoMap.get(a.tipoId) || '').toLowerCase() : '';
        if (!tipoNome.includes('bezerr')) return false;
        const dataNasc = parseDataBR(a.dataNascimento);
        return dataNasc && dataNasc >= inicio12m;
      }).length;
      
      const mortes12m = animaisFazenda.filter(a => {
        const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
        if (statusNome !== 'morto') return false;
        const dataMorte = parseDataBR(a.dataSaida) ?? (a.updatedAt ? new Date(a.updatedAt) : null);
        return dataMorte && dataMorte >= inicio12m;
      }).length;
      
      const gmdFazenda: number[] = [];
      animaisFazenda.forEach(animal => {
        const pesagensAnimal = pesagensRaw.filter(p => p.nascimentoId === animal.id || p.animalId === animal.id);
        if (pesagensAnimal.length >= 2) {
          const ordenadas = pesagensAnimal.sort((a, b) => {
            const da = new Date(a.dataPesagem.includes('/') ? a.dataPesagem.split('/').reverse().join('-') : a.dataPesagem);
            const db = new Date(b.dataPesagem.includes('/') ? b.dataPesagem.split('/').reverse().join('-') : b.dataPesagem);
            return da.getTime() - db.getTime();
          });
          const primeira = ordenadas[0];
          const ultima = ordenadas[ordenadas.length - 1];
          const dias = Math.floor((new Date(ultima.dataPesagem.includes('/') ? ultima.dataPesagem.split('/').reverse().join('-') : ultima.dataPesagem).getTime() - new Date(primeira.dataPesagem.includes('/') ? primeira.dataPesagem.split('/').reverse().join('-') : primeira.dataPesagem).getTime()) / (1000 * 60 * 60 * 24));
          if (dias > 0) gmdFazenda.push((ultima.peso - primeira.peso) / dias);
        }
      });
      const gmdMedioF = gmdFazenda.length > 0 ? gmdFazenda.reduce((a, b) => a + b, 0) / gmdFazenda.length : 0;
      
      const filhosFazenda = new Set(genealogiasRaw.filter(g => g.animalId && animaisFazenda.some(a => a.id === g.animalId)).map(g => g.animalId));
      const desmamasFazenda = desmamasRaw.filter(d => {
        const animalId = d.animalId || (d.nascimentoId ? animais.find(a => a.id === d.nascimentoId)?.id : null);
        return animalId && animaisFazenda.some(a => a.id === animalId);
      }).length;
      const nascimentosFazenda = animaisFazenda.filter(a => filhosFazenda.has(a.id)).length;
      const taxaDesmamaF = nascimentosFazenda > 0 ? (desmamasFazenda / nascimentosFazenda) * 100 : 0;
      
      benchmarkingFazendas.push({
        fazendaId: fId,
        nome: fazendaMap.get(fId) || 'Sem fazenda',
        total: totalF,
        nascimentos12m,
        mortes12m,
        gmdMedio: gmdMedioF,
        taxaDesmama: taxaDesmamaF
      });
    });
    
    benchmarkingFazendas.sort((a, b) => b.total - a.total);
    
    return {
      totalAnimais,
      totalVivos,
      totalMortos,
      variacaoMes,
      femeas,
      machos,
      bezerrasFemeas,
      bezerrosMachos,
      percentualFemeas,
      percentualMachos,
      percentualBezerrasFemeas,
      percentualBezerrosMachos,
      distribuicaoPorTipo,
      tiposOrdenados,
      totalMatrizes,
      matrizesAtivas,
      percentualMatrizes,
      distribuicaoPorFazenda,
      evolucaoRebanho,
      taxaMortalidade,
      taxaMortalidadeMes,
      gmdMedio,
      gmdPorCategoria,
      iepMedio,
      taxaDesmama,
      totalDesmamas,
      totalNascimentos,
      comparativoMes,
      comparativoAno,
      tendenciaRebanho,
      tendenciaPercentual,
      benchmarkingFazendas,
      isLoading: false
    };
  }, [animaisRaw, tipoMap, statusMap, fazendaMap, matrizesSet, pesagensRaw, desmamasRaw, genealogiasRaw, fazendaId, periodoMeses, tipoIdsSet, statusIdsSet]);
  
  return { ...metrics, isLoading };
}
