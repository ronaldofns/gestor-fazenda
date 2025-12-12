import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'gerente' | 'peao' | 'visitante' | ('admin' | 'gerente' | 'peao' | 'visitante')[];
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-500">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Salvar a rota que estava tentando acessar para redirecionar após login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar role se necessário
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-red-600 text-lg font-semibold mb-2">Acesso Negado</div>
            <div className="text-gray-600">
              Você não tem permissão para acessar esta página.
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

