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
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toLocaleDateString('pt-BR');
}
