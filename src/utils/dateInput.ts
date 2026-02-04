/**
 * Utilitários para manipulação de datas em inputs
 * Formato padrão: DD/MM/YYYY
 */

/**
 * Normaliza input de data para formato DD/MM/YYYY
 * Remove caracteres não numéricos e formata automaticamente
 */
export function normalizarDataInput(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Converte data de YYYY-MM-DD (banco) para DD/MM/YYYY (input)
 */
export function converterDataParaFormatoInput(data?: string): string {
  if (!data) return '';
  // Se já está no formato DD/MM/YYYY, retornar como está
  if (data.includes('/')) {
    return data;
  }
  // Se está no formato YYYY-MM-DD, converter para DD/MM/YYYY
  if (data.includes('-')) {
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
  }
  return data;
}

/**
 * Converte data de DD/MM/YYYY (input) para YYYY-MM-DD (banco)
 */
export function converterDataParaFormatoBanco(data?: string): string {
  if (!data) return '';
  // Se já está no formato YYYY-MM-DD, retornar como está
  if (data.includes('-') && data.length === 10) {
    return data;
  }
  // Se está no formato DD/MM/YYYY, converter para YYYY-MM-DD
  if (data.includes('/')) {
    const partes = data.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }
  return data;
}
