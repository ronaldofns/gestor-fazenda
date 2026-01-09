import { ColorPaletteKey } from '../hooks/useThemeColors';

/**
 * Helper para obter classes Tailwind CSS baseadas na cor primária
 * Como o Tailwind não suporta classes dinâmicas, precisamos mapear todas as possibilidades
 */
export function getThemeClasses(color: ColorPaletteKey, type: 'bg' | 'text' | 'border' | 'ring' | 'gradient-from' | 'gradient-to' | 'hover-bg' | 'hover-text' | 'bg-light' | 'border-light'): string {
  const classMap: Record<ColorPaletteKey, Record<string, string>> = {
    green: {
      bg: 'bg-green-600',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-500',
      ring: 'ring-green-500',
      'gradient-from': 'from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20',
      'gradient-to': 'from-green-500 to-green-600',
      'hover-bg': 'hover:bg-green-700',
      'hover-text': 'hover:text-green-800 dark:hover:text-green-300',
      'bg-light': 'bg-green-50/60 dark:bg-green-800/60',
      'border-light': 'border-green-200 dark:border-green-700',
    },
    blue: {
      bg: 'bg-blue-600',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500',
      ring: 'ring-blue-500',
      'gradient-from': 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20',
      'gradient-to': 'from-blue-500 to-blue-600',
      'hover-bg': 'hover:bg-blue-700',
      'hover-text': 'hover:text-blue-800 dark:hover:text-blue-300',
      'bg-light': 'bg-blue-50/60 dark:bg-blue-800/60',
      'border-light': 'border-blue-200 dark:border-blue-700',
    },
    emerald: {
      bg: 'bg-emerald-600',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500',
      ring: 'ring-emerald-500',
      'gradient-from': 'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20',
      'gradient-to': 'from-emerald-500 to-emerald-600',
      'hover-bg': 'hover:bg-emerald-700',
      'hover-text': 'hover:text-emerald-800 dark:hover:text-emerald-300',
      'bg-light': 'bg-emerald-50/60 dark:bg-emerald-800/60',
      'border-light': 'border-emerald-200 dark:border-emerald-700',
    },
    teal: {
      bg: 'bg-teal-600',
      text: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-500',
      ring: 'ring-teal-500',
      'gradient-from': 'from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/20',
      'gradient-to': 'from-teal-500 to-teal-600',
      'hover-bg': 'hover:bg-teal-700',
      'hover-text': 'hover:text-teal-800 dark:hover:text-teal-300',
      'bg-light': 'bg-teal-50/60 dark:bg-teal-800/60',
      'border-light': 'border-teal-200 dark:border-teal-700',
    },
    indigo: {
      bg: 'bg-indigo-600',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500',
      ring: 'ring-indigo-500',
      'gradient-from': 'from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20',
      'gradient-to': 'from-indigo-500 to-indigo-600',
      'hover-bg': 'hover:bg-indigo-700',
      'hover-text': 'hover:text-indigo-800 dark:hover:text-indigo-300',
      'bg-light': 'bg-indigo-50/60 dark:bg-indigo-800/60',
      'border-light': 'border-indigo-200 dark:border-indigo-700',
    },
    purple: {
      bg: 'bg-purple-600',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500',
      ring: 'ring-purple-500',
      'gradient-from': 'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20',
      'gradient-to': 'from-purple-500 to-purple-600',
      'hover-bg': 'hover:bg-purple-700',
      'hover-text': 'hover:text-purple-800 dark:hover:text-purple-300',
      'bg-light': 'bg-purple-50/60 dark:bg-purple-800/60',
      'border-light': 'border-purple-200 dark:border-purple-700',
    },
    gray: {
      bg: 'bg-gray-600',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-500',
      ring: 'ring-gray-500',
      'gradient-from': 'from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/20',
      'gradient-to': 'from-gray-500 to-gray-600',
      'hover-bg': 'hover:bg-gray-700',
      'hover-text': 'hover:text-gray-800 dark:hover:text-gray-300',
      'bg-light': 'bg-gray-50/60 dark:bg-gray-800/60',
      'border-light': 'border-gray-200 dark:border-gray-700',
    },
  };

  return classMap[color]?.[type] || classMap.gray[type];
}

/**
 * Helper para obter classes de texto de título baseadas na cor primária
 */
export function getTitleTextClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'text-green-700 dark:text-green-100',
    blue: 'text-blue-700 dark:text-blue-100',
    emerald: 'text-emerald-700 dark:text-emerald-100',
    teal: 'text-teal-700 dark:text-teal-100',
    indigo: 'text-indigo-700 dark:text-indigo-100',
    purple: 'text-purple-700 dark:text-purple-100',
    gray: 'text-gray-700 dark:text-gray-100',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de background de botão primário
 */
export function getPrimaryButtonClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    teal: 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-500',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
    purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
    gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter apenas a classe bg (sem hover/focus) - útil para Toast
 */
export function getPrimaryBgClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'bg-green-600',
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    teal: 'bg-teal-600',
    indigo: 'bg-indigo-600',
    purple: 'bg-purple-600',
    gray: 'bg-gray-600',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de botão de tema (toggle dark/light)
 */
export function getThemeToggleButtonClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'border-green-200 dark:border-green-700 bg-green-50/60 dark:bg-green-800/60 text-green-700 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-700',
    blue: 'border-blue-200 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-800/60 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-700',
    emerald: 'border-emerald-200 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-800/60 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-700',
    teal: 'border-teal-200 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-800/60 text-teal-700 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-700',
    indigo: 'border-indigo-200 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-800/60 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-700',
    purple: 'border-purple-200 dark:border-purple-700 bg-purple-50/60 dark:bg-purple-800/60 text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-700',
    gray: 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de borda do separador
 */
export function getSeparatorBorderClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'border-gray-300 dark:border-green-700/50',
    blue: 'border-gray-300 dark:border-blue-700/50',
    emerald: 'border-gray-300 dark:border-emerald-700/50',
    teal: 'border-gray-300 dark:border-teal-700/50',
    indigo: 'border-gray-300 dark:border-indigo-700/50',
    purple: 'border-gray-300 dark:border-purple-700/50',
    gray: 'border-gray-300 dark:border-gray-700/50',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de badge/card com cor primária
 */
export function getPrimaryBadgeClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de card/border com cor primária
 */
export function getPrimaryCardClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'border-green-200 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10',
    blue: 'border-blue-200 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10',
    emerald: 'border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10',
    teal: 'border-teal-200 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/10',
    indigo: 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10',
    purple: 'border-purple-200 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de botão pequeno (badge button)
 */
export function getPrimarySmallButtonClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'bg-green-500 hover:bg-green-600',
    blue: 'bg-blue-500 hover:bg-blue-600',
    emerald: 'bg-emerald-500 hover:bg-emerald-600',
    teal: 'bg-teal-500 hover:bg-teal-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    gray: 'bg-gray-500 hover:bg-gray-600',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de botão de ação pequeno (icon button com hover)
 */
export function getPrimaryActionButtonClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'text-green-700 hover:text-green-900 hover:bg-green-50 dark:hover:bg-green-900/30',
    blue: 'text-blue-700 hover:text-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    emerald: 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
    teal: 'text-teal-700 hover:text-teal-900 hover:bg-teal-50 dark:hover:bg-teal-900/30',
    indigo: 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
    purple: 'text-purple-700 hover:text-purple-900 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    gray: 'text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/30',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de botão de ação pequeno com variação (texto mais claro)
 */
export function getPrimaryActionButtonLightClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30',
    blue: 'text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    emerald: 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
    teal: 'text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30',
    indigo: 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
    purple: 'text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    gray: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/30',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de hover/background do dropdown do Combobox (para estado ativo/highlighted)
 */
export function getComboboxOptionHoverClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'bg-green-50 dark:bg-green-900/40',
    blue: 'bg-blue-50 dark:bg-blue-900/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/40',
    teal: 'bg-teal-50 dark:bg-teal-900/40',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/40',
    purple: 'bg-purple-50 dark:bg-purple-900/40',
    gray: 'bg-gray-50 dark:bg-gray-900/40',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de hover do dropdown do Combobox (para hover state)
 */
export function getComboboxOptionHoverStateClass(color: ColorPaletteKey): string {
  const classMap: Record<ColorPaletteKey, string> = {
    green: 'hover:bg-green-50 dark:hover:bg-green-900/40',
    blue: 'hover:bg-blue-50 dark:hover:bg-blue-900/40',
    emerald: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/40',
    teal: 'hover:bg-teal-50 dark:hover:bg-teal-900/40',
    indigo: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/40',
    purple: 'hover:bg-purple-50 dark:hover:bg-purple-900/40',
    gray: 'hover:bg-gray-50 dark:hover:bg-gray-900/40',
  };
  return classMap[color] || classMap.gray;
}

/**
 * Helper para obter classes de checkbox com cor primária
 * Usa accent-color para funcionar com checkboxes nativos
 */
export function getCheckboxClass(color: ColorPaletteKey): string {
  const accentColorMap: Record<ColorPaletteKey, string> = {
    green: 'accent-green-600',
    blue: 'accent-blue-600',
    emerald: 'accent-emerald-600',
    teal: 'accent-teal-600',
    indigo: 'accent-indigo-600',
    purple: 'accent-purple-600',
    gray: 'accent-gray-600',
  };
  const ringClass = getThemeClasses(color, 'ring');
  return `${accentColorMap[color] || accentColorMap.green} ${ringClass} border-gray-300 dark:border-slate-700 rounded`;
}
