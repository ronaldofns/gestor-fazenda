import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';

export interface Alerta {
  id: string;
  tipo: 'desmama' | 'matriz' | 'peso' | 'vacina' | 'mortalidade';
  severidade: 'baixa' | 'media' | 'alta';
  titulo: string;
  mensagem: string;
  quantidade: number;
  icone: string;
  cor: string;
  lido: boolean; // Se o alerta foi marcado como lido
  detalhes?: any;
}

export interface AlertasMetrics {
  alertas: Alerta[];
  alertasNaoLidos: Alerta[]; // Apenas alertas não lidos
  totalAlertas: number;
  totalNaoLidos: number; // Total de alertas não lidos
  alertasAlta: number;
  alertasMedia: number;
  alertasBaixa: number;
  isLoading: boolean;
}

export function useAlertas(fazendaId?: string, usuarioId?: string): AlertasMetrics {
  // Carregar dados necessários
  const animaisRaw = useLiveQuery(() => db.animais.toArray(), []) || [];
  const tiposRaw = useLiveQuery(() => db.tiposAnimal.filter(t => !t.deletedAt).toArray(), []) || [];
  const statusRaw = useLiveQuery(() => db.statusAnimal.filter(s => !s.deletedAt).toArray(), []) || [];
  const desmamasRaw = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  const pesagensRaw = useLiveQuery(() => db.pesagens.toArray(), []) || [];
  const vacinacoesRaw = useLiveQuery(() => db.vacinacoes.toArray(), []) || [];
  const genealogiasRaw = useLiveQuery(() => db.genealogias.toArray(), []) || [];
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  // Carregar todas as notificações lidas e filtrar por usuário em JavaScript
  // (não requer índice no banco)
  const notificacoesLidasRaw = useLiveQuery(
    () => db.notificacoesLidas.toArray(),
    []
  ) || [];
  
  // Filtrar por usuário em memória
  const notificacoesLidasDoUsuario = useMemo(() => {
    if (!usuarioId) return notificacoesLidasRaw;
    return notificacoesLidasRaw.filter(n => n.usuarioId === usuarioId);
  }, [notificacoesLidasRaw, usuarioId]);

  const isLoading = animaisRaw === undefined;

  const alertas = useMemo<Alerta[]>(() => {
    if (isLoading) return [];

    const resultado: Alerta[] = [];

    // Mapas auxiliares
    const statusMap = new Map(statusRaw.map(s => [s.id, s.nome || 'Desconhecido']));
    const tipoMap = new Map(tiposRaw.map(t => [t.id, t.nome || 'Sem tipo']));
    const fazendaMap = new Map(fazendasRaw.map(f => [f.id, f.nome || 'Sem fazenda']));
    
    // Criar set de IDs de alertas lidos
    const alertasLidosSet = new Set(notificacoesLidasRaw.map(n => n.id));

    // Filtrar por fazenda se especificado
    let animais = fazendaId 
      ? animaisRaw.filter(a => a.fazendaId === fazendaId)
      : animaisRaw;

    // Apenas animais vivos
    animais = animais.filter(a => {
      const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
      return statusNome !== 'morto';
    });

    // ========================================
    // 1. ALERTA: DESMAMA ATRASADA
    // ========================================
    // Bezerros com +8 meses sem desmama
    const bezerrosSemDesmama = animais.filter(animal => {
      // Verificar se é bezerro
      const tipoNome = tipoMap.get(animal.tipoId)?.toLowerCase() || '';
      if (!tipoNome.includes('bezerr')) return false;

      // Calcular idade em meses
      if (!animal.dataNascimento) return false;
      const dataNasc = new Date(animal.dataNascimento);
      const hoje = new Date();
      const mesesIdade = (hoje.getTime() - dataNasc.getTime()) / (1000 * 60 * 60 * 24 * 30);

      // Verificar se tem mais de 8 meses
      if (mesesIdade < 8) return false;

      // Verificar se NÃO tem desmama registrada
      const temDesmama = desmamasRaw.some(d => d.animalId === animal.id);
      return !temDesmama;
    });

    if (bezerrosSemDesmama.length > 0) {
      resultado.push({
        id: 'desmama-atrasada',
        tipo: 'desmama',
        severidade: 'alta',
        titulo: 'Desmama Atrasada',
        mensagem: `${bezerrosSemDesmama.length} ${bezerrosSemDesmama.length === 1 ? 'bezerro está' : 'bezerros estão'} com mais de 8 meses sem desmama`,
        quantidade: bezerrosSemDesmama.length,
        icone: 'AlertTriangle',
        cor: 'red',
        lido: alertasLidosSet.has('desmama-atrasada'),
        detalhes: bezerrosSemDesmama.map(a => ({
          id: a.id,
          brinco: a.brinco,
          nome: a.nome,
          dataNascimento: a.dataNascimento
        }))
      });
    }

    // ========================================
    // 2. ALERTA: MATRIZ IMPRODUTIVA
    // ========================================
    // Matrizes sem parto há +18 meses
    const matrizesSet = new Set(genealogiasRaw.map(g => g.matrizId).filter(Boolean));
    const matrizesImprodutivas = animais.filter(animal => {
      // Verificar se é matriz
      if (!matrizesSet.has(animal.id)) return false;

      // Buscar último parto (nascimento mais recente de um filho)
      const filhos = genealogiasRaw.filter(g => g.matrizId === animal.id);
      if (filhos.length === 0) return false;

      const datasNascimento = filhos
        .map(f => {
          const filho = animais.find(a => a.id === f.animalId);
          return filho?.dataNascimento ? new Date(filho.dataNascimento) : null;
        })
        .filter(Boolean) as Date[];

      if (datasNascimento.length === 0) return false;

      // Pegar data do último parto
      const ultimoParto = new Date(Math.max(...datasNascimento.map(d => d.getTime())));
      const hoje = new Date();
      const mesesSemParto = (hoje.getTime() - ultimoParto.getTime()) / (1000 * 60 * 60 * 24 * 30);

      return mesesSemParto > 18;
    });

    if (matrizesImprodutivas.length > 0) {
      resultado.push({
        id: 'matriz-improdutiva',
        tipo: 'matriz',
        severidade: 'media',
        titulo: 'Matrizes Improdutivas',
        mensagem: `${matrizesImprodutivas.length} ${matrizesImprodutivas.length === 1 ? 'matriz está' : 'matrizes estão'} sem parto há mais de 18 meses`,
        quantidade: matrizesImprodutivas.length,
        icone: 'AlertCircle',
        cor: 'amber',
        lido: alertasLidosSet.has('matriz-improdutiva'),
        detalhes: matrizesImprodutivas.map(a => ({
          id: a.id,
          brinco: a.brinco,
          nome: a.nome
        }))
      });
    }

    // ========================================
    // 3. ALERTA: PESO CRÍTICO
    // ========================================
    // Animais abaixo de 70% do peso esperado
    // Para simplicidade, vamos considerar animais com peso muito baixo na última pesagem
    const animaisComPesoCritico = animais.filter(animal => {
      const pesagensAnimal = pesagensRaw
        .filter(p => p.nascimentoId === animal.id || p.animalId === animal.id)
        .filter(p => p.dataPesagem) // Validar se data existe
        .sort((a, b) => {
          const dataA = new Date(a.dataPesagem.includes('/') ? a.dataPesagem.split('/').reverse().join('-') : a.dataPesagem);
          const dataB = new Date(b.dataPesagem.includes('/') ? b.dataPesagem.split('/').reverse().join('-') : b.dataPesagem);
          return dataB.getTime() - dataA.getTime();
        });

      if (pesagensAnimal.length === 0) return false;

      const ultimaPesagem = pesagensAnimal[0];
      
      // Calcular idade em meses
      if (!animal.dataNascimento) return false;
      const dataNasc = new Date(animal.dataNascimento);
      const hoje = new Date();
      const mesesIdade = (hoje.getTime() - dataNasc.getTime()) / (1000 * 60 * 60 * 24 * 30);

      // Peso esperado aproximado (kg): 
      // Bezerro: 30kg ao nascer, +0.8kg/dia = ~24kg/mês
      // Simplificação: peso esperado = 30 + (mesesIdade * 24)
      const pesoEsperado = 30 + (mesesIdade * 24);
      const pesoMinimo = pesoEsperado * 0.7; // 70% do esperado

      return ultimaPesagem.peso < pesoMinimo;
    });

    if (animaisComPesoCritico.length > 0) {
      resultado.push({
        id: 'peso-critico',
        tipo: 'peso',
        severidade: 'alta',
        titulo: 'Peso Crítico',
        mensagem: `${animaisComPesoCritico.length} ${animaisComPesoCritico.length === 1 ? 'animal está' : 'animais estão'} abaixo do peso esperado`,
        quantidade: animaisComPesoCritico.length,
        icone: 'Scale',
        cor: 'orange',
        lido: alertasLidosSet.has('peso-critico'),
        detalhes: animaisComPesoCritico.map(a => ({
          id: a.id,
          brinco: a.brinco,
          nome: a.nome
        }))
      });
    }

    // ========================================
    // 4. ALERTA: VACINAS VENCIDAS
    // ========================================
    // Animais com vacinas que deveriam ser renovadas
    const hoje = new Date();
    const animaisComVacinasVencidas = animais.filter(animal => {
      const vacinacoesAnimal = vacinacoesRaw
        .filter(v => v.nascimentoId === animal.id || v.animalId === animal.id)
        .filter(v => v.dataAplicacao) // Validar se data existe
        .sort((a, b) => {
          const dataA = new Date(a.dataAplicacao.includes('/') ? a.dataAplicacao.split('/').reverse().join('-') : a.dataAplicacao);
          const dataB = new Date(b.dataAplicacao.includes('/') ? b.dataAplicacao.split('/').reverse().join('-') : b.dataAplicacao);
          return dataB.getTime() - dataA.getTime();
        });

      if (vacinacoesAnimal.length === 0) return false;

      // Verificar se a última vacinação foi há mais de 6 meses (ou dataVencimento passou)
      const ultimaVacinacao = vacinacoesAnimal[0];
      const dataRef = ultimaVacinacao.dataVencimento || ultimaVacinacao.dataAplicacao;
      if (!dataRef) return false;

      const dataRefDate = new Date(
        dataRef.includes('/') ? dataRef.split('/').reverse().join('-') : dataRef
      );
      const mesesDesde = (hoje.getTime() - dataRefDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return mesesDesde > 6;
    });

    if (animaisComVacinasVencidas.length > 0) {
      resultado.push({
        id: 'vacinas-vencidas',
        tipo: 'vacina',
        severidade: 'media',
        titulo: 'Vacinas Atrasadas',
        mensagem: `${animaisComVacinasVencidas.length} ${animaisComVacinasVencidas.length === 1 ? 'animal precisa' : 'animais precisam'} de reforço vacinal`,
        quantidade: animaisComVacinasVencidas.length,
        icone: 'Injection',
        cor: 'purple',
        lido: alertasLidosSet.has('vacinas-vencidas'),
        detalhes: animaisComVacinasVencidas.map(a => ({
          id: a.id,
          brinco: a.brinco,
          nome: a.nome
        }))
      });
    }

    // ========================================
    // 5. ALERTA: MORTALIDADE ALTA
    // ========================================
    // Fazendas com taxa de mortalidade > 5% no último mês
    const fazendaComMortalidadeAlta: string[] = [];
    
    if (!fazendaId) {
      // Calcular para cada fazenda
      const umMesAtras = new Date();
      umMesAtras.setMonth(umMesAtras.getMonth() - 1);

      fazendasRaw.forEach(fazenda => {
        const animaisFazenda = animaisRaw.filter(a => a.fazendaId === fazenda.id);
        const mortosNoMes = animaisFazenda.filter(a => {
          const statusNome = statusMap.get(a.statusId)?.toLowerCase() || '';
          if (statusNome !== 'morto') return false;
          
          const dataMorte = a.dataSaida 
            ? new Date(a.dataSaida) 
            : (a.updatedAt ? new Date(a.updatedAt) : null);
          
          return dataMorte && dataMorte >= umMesAtras && dataMorte <= hoje;
        }).length;

        const taxaMortalidade = animaisFazenda.length > 0 
          ? (mortosNoMes / animaisFazenda.length) * 100 
          : 0;

        if (taxaMortalidade > 5) {
          fazendaComMortalidadeAlta.push(fazenda.nome || fazenda.id);
        }
      });

      if (fazendaComMortalidadeAlta.length > 0) {
        resultado.push({
          id: 'mortalidade-alta',
          tipo: 'mortalidade',
          severidade: 'alta',
          titulo: 'Mortalidade Alta',
          mensagem: `${fazendaComMortalidadeAlta.length} ${fazendaComMortalidadeAlta.length === 1 ? 'fazenda está' : 'fazendas estão'} com taxa > 5% no mês`,
          quantidade: fazendaComMortalidadeAlta.length,
          icone: 'AlertTriangle',
          cor: 'red',
          lido: alertasLidosSet.has('mortalidade-alta'),
          detalhes: fazendaComMortalidadeAlta.map(nome => ({ nome }))
        });
      }
    }

    return resultado;
  }, [
    animaisRaw,
    tiposRaw,
    statusRaw,
    desmamasRaw,
    pesagensRaw,
    vacinacoesRaw,
    genealogiasRaw,
    fazendasRaw,
    notificacoesLidasRaw,
    fazendaId,
    isLoading
  ]);

  // Métricas agregadas
  const metrics = useMemo(() => {
    const totalAlertas = alertas.length;
    const alertasNaoLidos = alertas.filter(a => !a.lido);
    const totalNaoLidos = alertasNaoLidos.length;
    const alertasAlta = alertas.filter(a => a.severidade === 'alta').length;
    const alertasMedia = alertas.filter(a => a.severidade === 'media').length;
    const alertasBaixa = alertas.filter(a => a.severidade === 'baixa').length;

    return {
      alertas,
      alertasNaoLidos,
      totalAlertas,
      totalNaoLidos,
      alertasAlta,
      alertasMedia,
      alertasBaixa,
      isLoading
    };
  }, [alertas, isLoading]);

  return metrics;
}
