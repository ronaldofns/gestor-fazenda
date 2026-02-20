import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { UserRole } from "../db/models";
import { PermissionType } from "../db/models";
import ErrorPage from "./ErrorPage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
  requiredPermission?: PermissionType | PermissionType[];
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, loading, hasRole } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();
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
    if (!hasRole(roles)) {
      return <ErrorPage variant="forbidden" code={403} />;
    }
  }

  // Verificar permissão se necessário
  if (requiredPermission) {
    const permissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];
    if (!hasAnyPermission(permissions)) {
      return <ErrorPage variant="forbidden" code={403} />;
    }
  }

  return <>{children}</>;
}
