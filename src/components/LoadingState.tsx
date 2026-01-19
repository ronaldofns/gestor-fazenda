import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';

interface LoadingStateProps {
  message?: string;
  fullscreen?: boolean;
}

export function LoadingState({ message = 'Carregando...', fullscreen = false }: LoadingStateProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const spinnerColors: Record<ColorPaletteKey, string> = {
    green: 'border-green-600 dark:border-green-500',
    blue: 'border-blue-600 dark:border-blue-500',
    emerald: 'border-emerald-600 dark:border-emerald-500',
    teal: 'border-teal-600 dark:border-teal-500',
    indigo: 'border-indigo-600 dark:border-indigo-500',
    purple: 'border-purple-600 dark:border-purple-500',
    gray: 'border-gray-600 dark:border-gray-500',
  };

  const spinnerClass = spinnerColors[primaryColor] || spinnerColors.gray;

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`w-12 h-12 border-4 ${spinnerClass} border-t-transparent rounded-full animate-spin`}></div>
      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
        <Icons.Loader className="w-4 h-4 animate-pulse" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      {content}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const buttonColors: Record<ColorPaletteKey, string> = {
    green: 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
    blue: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600',
    teal: 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600',
    purple: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600',
    gray: 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600',
  };

  const buttonClass = buttonColors[primaryColor] || buttonColors.gray;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        {icon || <Icons.FileSearch className="w-8 h-8 text-gray-400 dark:text-slate-500" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-600 dark:text-slate-400 max-w-md mb-6">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${buttonClass}`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Erro ao carregar', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <Icons.AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-slate-400 max-w-md mb-6">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm font-medium transition-colors"
        >
          <Icons.RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
