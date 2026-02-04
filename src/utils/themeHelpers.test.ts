import { describe, it, expect } from 'vitest';
import { getThemeClasses, getPrimaryButtonClass } from './themeHelpers';

describe('themeHelpers', () => {
  describe('getThemeClasses', () => {
    it('retorna classe de fundo para green', () => {
      expect(getThemeClasses('green', 'bg')).toBe('bg-green-600');
    });

    it('retorna classe de texto para blue', () => {
      expect(getThemeClasses('blue', 'text')).toBe('text-blue-600 dark:text-blue-400');
    });

    it('retorna classe para gray', () => {
      expect(getThemeClasses('gray', 'bg')).toBe('bg-gray-600');
    });
  });

  describe('getPrimaryButtonClass', () => {
    it('retorna classes de botão primário para green', () => {
      const cls = getPrimaryButtonClass('green');
      expect(cls).toContain('bg-green-600');
      expect(cls).toContain('hover:bg-green-700');
    });
  });
});
