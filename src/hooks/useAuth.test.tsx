import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';

vi.mock('../utils/auth', () => ({
  getUserById: vi.fn(),
  authenticateUser: vi.fn()
}));

const getUserById = (await import('../utils/auth')).getUserById as ReturnType<typeof vi.fn>;

function TestUser() {
  const { user, loading, hasRole, isAdmin } = useAuth();
  if (loading) return <span>Carregando</span>;
  return (
    <div>
      <span data-testid="user-id">{user?.id ?? 'null'}</span>
      <span data-testid="user-role">{user?.role ?? 'null'}</span>
      <span data-testid="has-admin">{hasRole('admin') ? 'yes' : 'no'}</span>
      <span data-testid="is-admin">{isAdmin() ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(getUserById).mockReset();
    sessionStorage.clear();
  });

  it('mostra user null e hasRole false quando não há sessão', async () => {
    vi.mocked(getUserById).mockResolvedValue(null);
    render(
      <AuthProvider>
        <TestUser />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
    });
    expect(screen.getByTestId('has-admin')).toHaveTextContent('no');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('no');
  });

  it('carrega user da sessão quando getUserById retorna usuário', async () => {
    const usuario = { id: 'u1', nome: 'Admin', role: 'admin' as const, email: 'a@test.com', ativo: true };
    sessionStorage.setItem('gestor-fazenda-user-id', 'u1');
    vi.mocked(getUserById).mockResolvedValue(usuario);
    render(
      <AuthProvider>
        <TestUser />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('u1');
    });
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('has-admin')).toHaveTextContent('yes');
    expect(screen.getByTestId('is-admin')).toHaveTextContent('yes');
  });
});
