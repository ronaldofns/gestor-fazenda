import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icons } from '../utils/iconMapping';

export type ErrorPageVariant = 'forbidden' | 'not_found' | 'server_error' | 'error';

const config: Record<
  ErrorPageVariant,
  {
    title: string;
    description: string;
    actionLabel: string;
    actionTo?: string;
    onAction?: () => void;
    Icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    accentBorder: string;
  }
> = {
  forbidden: {
    title: 'Acesso negado',
    description: 'Você não tem permissão para acessar esta página. Solicite acesso a um administrador se necessário.',
    actionLabel: 'Ir para o início',
    actionTo: '/dashboard',
    Icon: Icons.Lock,
    iconBg: 'bg-rose-100 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    accentBorder: 'border-rose-200 dark:border-rose-500/40',
  },
  not_found: {
    title: 'Página não encontrada',
    description: 'A página que você procura não existe ou foi movida. Verifique o endereço ou volte ao início.',
    actionLabel: 'Voltar ao início',
    actionTo: '/dashboard',
    Icon: Icons.Search,
    iconBg: 'bg-slate-100 dark:bg-slate-600/30',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accentBorder: 'border-slate-200 dark:border-slate-600',
  },
  server_error: {
    title: 'Erro no servidor',
    description: 'Algo deu errado ao processar sua solicitação. Tente recarregar a página ou volte mais tarde.',
    actionLabel: 'Recarregar página',
    onAction: () => window.location.reload(),
    Icon: Icons.AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-amber-200 dark:border-amber-500/40',
  },
  error: {
    title: 'Algo deu errado',
    description: 'Ocorreu um erro inesperado. Extensões do navegador podem causar isso. Tente em janela anônima ou recarregue a página.',
    actionLabel: 'Recarregar página',
    onAction: () => window.location.reload(),
    Icon: Icons.AlertCircle,
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-amber-200 dark:border-amber-500/40',
  },
};

interface ErrorPageProps {
  variant: ErrorPageVariant;
  /** Código numérico opcional (403, 404, 500) para exibir ao lado do título */
  code?: number;
  /** Substituir descrição padrão */
  description?: string;
  /** Quando true, ocupa altura mínima da área de conteúdo */
  fullHeight?: boolean;
}

export default function ErrorPage({ variant, code, description, fullHeight = true }: ErrorPageProps) {
  const navigate = useNavigate();
  const c = config[variant];
  const Icon = c.Icon;

  const handleAction = () => {
    if (c.onAction) {
      c.onAction();
      return;
    }
    if (c.actionTo) navigate(c.actionTo);
  };

  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-12 sm:py-16 ${
        fullHeight ? 'min-h-[60vh]' : ''
      }`}
    >
      <div
        className={`w-full max-w-md rounded-2xl border bg-white dark:bg-slate-900 shadow-lg dark:shadow-none ${c.accentBorder} overflow-hidden`}
      >
        <div className="p-8 sm:p-10 text-center">
          {code != null && (
            <div className="text-6xl sm:text-7xl font-bold text-gray-200 dark:text-slate-700 tracking-tight mb-2">
              {code}
            </div>
          )}
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 ${c.iconBg} ${c.iconColor}`}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {c.title}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mb-8 leading-relaxed">
            {description ?? c.description}
          </p>
          {c.actionTo && !c.onAction ? (
            <Link
              to={c.actionTo}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 text-white font-medium text-sm transition-colors shadow-sm"
            >
              {Icons.LayoutDashboard && <Icons.LayoutDashboard className="w-4 h-4" />}
              {c.actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 text-white font-medium text-sm transition-colors shadow-sm"
            >
              {variant === 'server_error' || variant === 'error' ? (
                <Icons.RefreshCw className="w-4 h-4" />
              ) : (
                Icons.LayoutDashboard && <Icons.LayoutDashboard className="w-4 h-4" />
              )}
              {c.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
