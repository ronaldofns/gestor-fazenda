/**
 * Normaliza o valor do Combobox para garantir que seja sempre uma string
 * @param value - Valor do Combobox (pode ser string, objeto ou undefined)
 * @returns String normalizada
 */
export function normalizeComboboxValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) return String(obj.value);
    if ('label' in obj) return String(obj.label);
    if ('id' in obj) return String(obj.id);
  }
  return String(value);
}

/**
 * Normaliza o onChange do Combobox para garantir que retorne sempre uma string
 * @param value - Valor recebido no onChange
 * @returns String normalizada
 */
export function normalizeComboboxOnChange(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) return String(obj.value);
    if ('label' in obj) return String(obj.label);
  }
  return String(value);
}
