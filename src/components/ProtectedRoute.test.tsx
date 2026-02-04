import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: vi.fn()
}));

const useAuth = (await import('../hooks/useAuth')).useAuth as ReturnType<typeof vi.fn>;
const usePermissions = (await import('../hooks/usePermissions')).usePermissions as ReturnType<typeof vi.fn>;

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  it('mostra loading quando loading é true', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true, hasRole: () => false });
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: () => false, hasAnyPermission: () => false });
    renderWithRouter(
      <ProtectedRoute>
        <span>Conteúdo protegido</span>
      </ProtectedRoute>
    );
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('não mostra conteúdo quando não há usuário (redireciona para login)', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, hasRole: () => false });
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: () => false, hasAnyPermission: () => false });
    renderWithRouter(
      <ProtectedRoute>
        <span>Conteúdo protegido</span>
      </ProtectedRoute>
    );
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('mostra conteúdo quando usuário está logado e não há restrição de permissão', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', nome: 'User', role: 'gerente', email: 'u@test.com', ativo: true },
      loading: false,
      hasRole: () => true
    });
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: () => true, hasAnyPermission: () => true });
    renderWithRouter(
      <ProtectedRoute>
        <span>Conteúdo protegido</span>
      </ProtectedRoute>
    );
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });

  it('mostra Acesso Negado quando requiredPermission não é atendida', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', nome: 'User', role: 'peao', email: 'u@test.com', ativo: true },
      loading: false,
      hasRole: () => true
    });
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: () => false, hasAnyPermission: () => false });
    renderWithRouter(
      <ProtectedRoute requiredPermission="gerenciar_usuarios">
        <span>Conteúdo protegido</span>
      </ProtectedRoute>
    );
    expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });
});
