/**
 * Interpreta string de data como data local (evita deslocamento de 1 dia com YYYY-MM-DD em UTC).
 * Para YYYY-MM-DD retorna meia-noite no fuso local; para outros formatos usa new Date(str).
 */
export function parseDateOnlyLocal(value: string | undefined | null): Date | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateBR(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toLocaleDateString('pt-BR');
  }
  const str = String(value).trim();
  if (!str) return '';
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  // YYYY-MM-DD — não usar new Date() para evitar UTC (ex.: 01/01/2024 virar 31/12/2023 no Brasil)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toLocaleDateString('pt-BR');
}
