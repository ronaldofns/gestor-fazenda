import { Pesagem } from '../db/models';

/**
 * Calcula o Ganho Médio Diário (GMD) entre duas pesagens
 * GMD = (Peso Final - Peso Inicial) / Número de dias
 * 
 * @param pesoInicial Peso inicial em kg
 * @param pesoFinal Peso final em kg
 * @param dataInicial Data inicial (YYYY-MM-DD ou DD/MM/YYYY)
 * @param dataFinal Data final (YYYY-MM-DD ou DD/MM/YYYY)
 * @returns GMD em kg/dia ou null se não for possível calcular
 */
export function calcularGMD(
  pesoInicial: number,
  pesoFinal: number,
  dataInicial: string,
  dataFinal: string
): number | null {
  if (!pesoInicial || !pesoFinal || !dataInicial || !dataFinal) {
    return null;
  }

  // Converter datas para formato Date
  const dataIni = parseDate(dataInicial);
  const dataFim = parseDate(dataFinal);

  if (!dataIni || !dataFim) {
    return null;
  }

  // Calcular diferença em dias
  const diffTime = dataFim.getTime() - dataIni.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) {
    return null; // Datas inválidas ou iguais
  }

  // Calcular GMD
  const gmd = (pesoFinal - pesoInicial) / diffDays;
  return Math.round(gmd * 100) / 100; // Arredondar para 2 casas decimais
}

/**
 * Calcula o GMD médio de um animal baseado em todas as pesagens
 * 
 * @param pesagens Array de pesagens ordenadas por data
 * @param pesoNascimento Peso ao nascer (opcional)
 * @param dataNascimento Data de nascimento (opcional)
 * @returns GMD médio em kg/dia ou null se não for possível calcular
 */
export function calcularGMDAcumulado(
  pesagens: Pesagem[],
  pesoNascimento?: number,
  dataNascimento?: string
): number | null {
  if (pesagens.length === 0 && !pesoNascimento) {
    return null;
  }

  // Ordenar pesagens por data
  const pesagensOrdenadas = [...pesagens].sort((a, b) => {
    const dataA = parseDate(a.dataPesagem);
    const dataB = parseDate(b.dataPesagem);
    if (!dataA || !dataB) return 0;
    return dataA.getTime() - dataB.getTime();
  });

  // Se não tem pesagens, mas tem peso de nascimento e desmama, usar desmama
  if (pesagensOrdenadas.length === 0) {
    return null;
  }

  // Se tem peso de nascimento, usar como primeira pesagem
  let pesoInicial: number | null = null;
  let dataInicial: Date | null = null;

  if (pesoNascimento && dataNascimento) {
    pesoInicial = pesoNascimento;
    dataInicial = parseDate(dataNascimento);
  } else if (pesagensOrdenadas.length > 0) {
    pesoInicial = pesagensOrdenadas[0].peso;
    dataInicial = parseDate(pesagensOrdenadas[0].dataPesagem);
  }

  if (!pesoInicial || !dataInicial) {
    return null;
  }

  // Usar a última pesagem como referência
  const ultimaPesagem = pesagensOrdenadas[pesagensOrdenadas.length - 1];
  const pesoFinal = ultimaPesagem.peso;
  const dataFinal = parseDate(ultimaPesagem.dataPesagem);

  if (!dataFinal) {
    return null;
  }

  return calcularGMD(pesoInicial, pesoFinal, dataInicial.toISOString().split('T')[0], dataFinal.toISOString().split('T')[0]);
}

/**
 * Calcula o GMD entre pesagens consecutivas
 * 
 * @param pesagens Array de pesagens ordenadas por data
 * @returns Array de objetos com GMD entre cada par de pesagens consecutivas
 */
export function calcularGMDEntrePesagens(pesagens: Pesagem[]): Array<{
  dataInicial: string;
  dataFinal: string;
  pesoInicial: number;
  pesoFinal: number;
  dias: number;
  gmd: number;
}> {
  if (pesagens.length < 2) {
    return [];
  }

  // Ordenar por data
  const ordenadas = [...pesagens].sort((a, b) => {
    const dataA = parseDate(a.dataPesagem);
    const dataB = parseDate(b.dataPesagem);
    if (!dataA || !dataB) return 0;
    return dataA.getTime() - dataB.getTime();
  });

  const resultados: Array<{
    dataInicial: string;
    dataFinal: string;
    pesoInicial: number;
    pesoFinal: number;
    dias: number;
    gmd: number;
  }> = [];

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const atual = ordenadas[i];
    const proxima = ordenadas[i + 1];

    const dataIni = parseDate(atual.dataPesagem);
    const dataFim = parseDate(proxima.dataPesagem);

    if (!dataIni || !dataFim) continue;

    const diffTime = dataFim.getTime() - dataIni.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays <= 0) continue;

    const gmd = (proxima.peso - atual.peso) / diffDays;

    resultados.push({
      dataInicial: atual.dataPesagem,
      dataFinal: proxima.dataPesagem,
      pesoInicial: atual.peso,
      pesoFinal: proxima.peso,
      dias: Math.round(diffDays),
      gmd: Math.round(gmd * 100) / 100
    });
  }

  return resultados;
}

/**
 * Converte string de data para objeto Date
 * Suporta formatos: YYYY-MM-DD e DD/MM/YYYY
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Formato YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  // Formato DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexed
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  // Tentar parse direto
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}
