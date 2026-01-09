import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Usuario, UserRole } from '../db/models';
import { authenticateUser, getUserById } from '../utils/auth';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar sessão persistida ao inicializar
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedUserId = localStorage.getItem('gestor-fazenda-user-id');
        if (savedUserId) {
          const usuario = await getUserById(savedUserId);
          if (usuario && usuario.ativo) {
            setUser(usuario);
          } else {
            // Se usuário não encontrado ou inativo, limpar sessão
            localStorage.removeItem('gestor-fazenda-user-id');
          }
        }
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
        localStorage.removeItem('gestor-fazenda-user-id');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    const usuario = await authenticateUser(email, password);
    if (!usuario) {
      throw new Error('Email ou senha incorretos');
    }
    setUser(usuario);
    localStorage.setItem('gestor-fazenda-user-id', usuario.id);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('gestor-fazenda-user-id');
  };

  const refreshUser = async () => {
    if (user?.id) {
      const updatedUser = await getUserById(user.id);
      if (updatedUser) {
        setUser(updatedUser);
      }
    }
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return hasRole(roles);
  };

  const isAdmin = (): boolean => {
    return hasRole('admin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole,
        hasAnyRole,
        isAdmin,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
