import { useMemo } from 'react';
import { useAppSettings } from './useAppSettings';

// Paleta de cores padrão (cinza)
export const DEFAULT_PRIMARY_COLOR = {
  name: 'Cinza',
  value: 'gray',
  shades: {
    50: 'gray-50',
    100: 'gray-100',
    200: 'gray-200',
    300: 'gray-300',
    400: 'gray-400',
    500: 'gray-500',
    600: 'gray-600',
    700: 'gray-700',
    800: 'gray-800',
    900: 'gray-900',
  }
};

// Paletas de cores predefinidas
export const COLOR_PALETTES = {
  green: {
    name: 'Verde',
    value: 'green',
    shades: {
      50: 'green-50',
      100: 'green-100',
      200: 'green-200',
      300: 'green-300',
      400: 'green-400',
      500: 'green-500',
      600: 'green-600',
      700: 'green-700',
      800: 'green-800',
      900: 'green-900',
    }
  },
  blue: {
    name: 'Azul',
    value: 'blue',
    shades: {
      50: 'blue-50',
      100: 'blue-100',
      200: 'blue-200',
      300: 'blue-300',
      400: 'blue-400',
      500: 'blue-500',
      600: 'blue-600',
      700: 'blue-700',
      800: 'blue-800',
      900: 'blue-900',
    }
  },
  emerald: {
    name: 'Esmeralda',
    value: 'emerald',
    shades: {
      50: 'emerald-50',
      100: 'emerald-100',
      200: 'emerald-200',
      300: 'emerald-300',
      400: 'emerald-400',
      500: 'emerald-500',
      600: 'emerald-600',
      700: 'emerald-700',
      800: 'emerald-800',
      900: 'emerald-900',
    }
  },
  teal: {
    name: 'Verde-azulado',
    value: 'teal',
    shades: {
      50: 'teal-50',
      100: 'teal-100',
      200: 'teal-200',
      300: 'teal-300',
      400: 'teal-400',
      500: 'teal-500',
      600: 'teal-600',
      700: 'teal-700',
      800: 'teal-800',
      900: 'teal-900',
    }
  },
  indigo: {
    name: 'Anil',
    value: 'indigo',
    shades: {
      50: 'indigo-50',
      100: 'indigo-100',
      200: 'indigo-200',
      300: 'indigo-300',
      400: 'indigo-400',
      500: 'indigo-500',
      600: 'indigo-600',
      700: 'indigo-700',
      800: 'indigo-800',
      900: 'indigo-900',
    }
  },
  purple: {
    name: 'Roxo',
    value: 'purple',
    shades: {
      50: 'purple-50',
      100: 'purple-100',
      200: 'purple-200',
      300: 'purple-300',
      400: 'purple-400',
      500: 'purple-500',
      600: 'purple-600',
      700: 'purple-700',
      800: 'purple-800',
      900: 'purple-900',
    }
  },
  gray: {
    name: 'Cinza',
    value: 'gray',
    shades: {
      50: 'gray-50',
      100: 'gray-100',
      200: 'gray-200',
      300: 'gray-300',
      400: 'gray-400',
      500: 'gray-500',
      600: 'gray-600',
      700: 'gray-700',
      800: 'gray-800',
      900: 'gray-900',
    }
  }
} as const;

export type ColorPaletteKey = keyof typeof COLOR_PALETTES;
export type ColorPalette = typeof COLOR_PALETTES[ColorPaletteKey];

/**
 * Hook para obter classes CSS baseadas na cor primária configurada
 */
export function useThemeColors() {
  const { appSettings } = useAppSettings();
  
  const primaryColor = useMemo(() => {
    const colorKey = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
    return COLOR_PALETTES[colorKey] || DEFAULT_PRIMARY_COLOR;
  }, [appSettings.primaryColor]);

  // Função helper para gerar classes CSS com a cor primária
  const getColorClass = useMemo(() => {
    return (shade: keyof typeof primaryColor.shades, prefix: string = '') => {
      const colorClass = primaryColor.shades[shade];
      // Para Tailwind, precisamos retornar a classe completa
      return prefix ? `${prefix}-${colorClass}` : colorClass;
    };
  }, [primaryColor]);

  // Função para obter classes CSS dinâmicas (retorna string completa)
  const getClassName = useMemo(() => {
    return (template: string) => {
      // Substituir placeholders como {color-500} pela cor real
      return template
        .replace(/\{color-50\}/g, primaryColor.shades[50])
        .replace(/\{color-100\}/g, primaryColor.shades[100])
        .replace(/\{color-200\}/g, primaryColor.shades[200])
        .replace(/\{color-300\}/g, primaryColor.shades[300])
        .replace(/\{color-400\}/g, primaryColor.shades[400])
        .replace(/\{color-500\}/g, primaryColor.shades[500])
        .replace(/\{color-600\}/g, primaryColor.shades[600])
        .replace(/\{color-700\}/g, primaryColor.shades[700])
        .replace(/\{color-800\}/g, primaryColor.shades[800])
        .replace(/\{color-900\}/g, primaryColor.shades[900]);
    };
  }, [primaryColor]);

  // Classes comuns pré-definidas
  const colors = useMemo(() => ({
    // Backgrounds
    bg: {
      primary: getColorClass(600, 'bg'),
      primaryLight: getColorClass(50, 'bg'),
      primaryHover: getColorClass(700, 'bg'),
      primaryActive: getColorClass(800, 'bg'),
    },
    // Text
    text: {
      primary: getColorClass(600, 'text'),
      primaryLight: getColorClass(400, 'text'),
      primaryDark: getColorClass(700, 'text'),
      primaryHover: getColorClass(800, 'text'),
    },
    // Borders
    border: {
      primary: getColorClass(500, 'border'),
      primaryLight: getColorClass(200, 'border'),
      primaryDark: getColorClass(700, 'border'),
    },
    // Rings (focus states)
    ring: {
      primary: getColorClass(500, 'ring'),
      primaryLight: getColorClass(200, 'ring'),
    },
    // Gradients
    gradient: {
      from: getColorClass(500, 'from'),
      to: getColorClass(600, 'to'),
      fromLight: getColorClass(50, 'from'),
      toLight: getColorClass(100, 'to'),
    },
    // Raw color value for custom usage
    raw: primaryColor.value,
    // All shades
    shades: primaryColor.shades,
  }), [getColorClass, primaryColor]);

  return {
    ...colors,
    getClassName, // Adicionar função helper para templates
    primaryColor, // Expor a paleta completa
  };
}
