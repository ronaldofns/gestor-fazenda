/**
 * Mensagens de validação padronizadas em português
 * Use em schemas Zod para manter consistência em todo o app
 */
export const msg = {
  /** Campo de texto obrigatório */
  obrigatorio: 'Campo obrigatório',
  /** Campo numérico vazio ou inválido */
  informeValor: 'Informe o valor',
  /** Valor numérico deve ser positivo */
  valorMaiorQueZero: 'O valor deve ser maior que zero',
  /** Data obrigatória */
  dataObrigatoria: 'Data é obrigatória',
  /** Formato de data */
  formatoData: 'Formato: dd/mm/aaaa',
  /** Email inválido */
  emailInvalido: 'Email inválido',
  /** Seleção obrigatória */
  selecione: 'Selecione uma opção',
  /** Senha mínima */
  senhaMinima: 'A senha deve ter no mínimo 6 caracteres',
  /** Confirmar senha */
  confirmeSenha: 'Confirme a senha',
  /** Senhas não coincidem */
  senhasNaoCoincidem: 'As senhas não coincidem'
} as const;
