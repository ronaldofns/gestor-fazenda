import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('../hooks/useAppSettings', () => ({
  useAppSettings: () => ({
    appSettings: { primaryColor: 'gray' }
  })
}));

vi.mock('../db/dexieDB', () => ({
  db: {
    usuarios: { toArray: vi.fn(() => Promise.resolve([{ id: '1', nome: 'Test', email: 'test@test.com' }])) }
  }
}));

vi.mock('../api/syncService', () => ({
  pullUsuarios: vi.fn(() => Promise.resolve())
}));

const useAuth = (await import('../hooks/useAuth')).useAuth as ReturnType<typeof vi.fn>;

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      logout: vi.fn(),
      hasRole: () => false,
      hasAnyRole: () => false,
      isAdmin: () => false,
      refreshUser: vi.fn()
    });
    mockLogin.mockReset();
  });

  it('exibe formulário de login após carregar', async () => {
    renderLogin();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/seu@email\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sua senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar no sistema/i })).toBeInTheDocument();
  });

  it('chama login com email e senha ao enviar o formulário', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/seu@email\.com/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText(/seu@email\.com/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/sua senha/i), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar no sistema/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'senha123');
    });
  });
});
