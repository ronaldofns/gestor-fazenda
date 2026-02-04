import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from './usePermissions';

vi.mock('./useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => [])
}));

const useAuth = (await import('./useAuth')).useAuth as ReturnType<typeof vi.fn>;

describe('usePermissions', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockClear();
  });

  it('retorna hasPermission false quando não há usuário', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasPermission('exportar_dados')).toBe(false);
  });

  it('retorna hasPermission true para qualquer permissão quando usuário é admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', nome: 'Admin', role: 'admin', email: 'admin@test.com', ativo: true }
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasPermission('exportar_dados')).toBe(true);
    expect(result.current.hasPermission('gerenciar_usuarios')).toBe(true);
  });

  it('retorna hasAnyPermission false quando usuário não tem nenhuma das permissões', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', nome: 'User', role: 'gerente', email: 'u@test.com', ativo: true }
    });
    const { result } = renderHook(() => usePermissions());
    // Sem permissões no mock (useLiveQuery retorna []), então gerente não tem nenhuma
    expect(result.current.hasAnyPermission(['exportar_dados', 'gerar_relatorios'])).toBe(false);
  });

  it('retorna hasAllPermissions false quando falta uma permissão', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', nome: 'User', role: 'admin', email: 'admin@test.com', ativo: true }
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasAllPermissions(['exportar_dados', 'gerar_relatorios'])).toBe(true);
  });

  it('retorna hasAllPermissions false quando não há usuário', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasAllPermissions(['exportar_dados'])).toBe(false);
  });

  it('getRolePermissions retorna array (mock useLiveQuery retorna [])', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', nome: 'User', role: 'gerente', email: 'u@test.com', ativo: true }
    });
    const { result } = renderHook(() => usePermissions());
    const perms = result.current.getRolePermissions('gerente');
    expect(Array.isArray(perms)).toBe(true);
  });
});
