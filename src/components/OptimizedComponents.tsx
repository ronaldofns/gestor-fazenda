import { memo, ReactNode } from 'react';
import { Icons } from '../utils/iconMapping';

/**
 * Componentes otimizados com React.memo para evitar re-renders desnecessários
 */

// Badge otimizado
interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
  className?: string;
}

export const OptimizedBadge = memo(({ children, variant = 'default', className = '' }: BadgeProps) => {
  const variantClasses = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
});

OptimizedBadge.displayName = 'OptimizedBadge';

// Botão de ação otimizado
interface ActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
}

export const OptimizedActionButton = memo(({ 
  onClick, 
  icon, 
  label, 
  variant = 'primary',
  disabled = false,
  className = ''
}: ActionButtonProps) => {
  const variantClasses = {
    primary: 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
    secondary: 'text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
    danger: 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300',
    success: 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-slate-700'} ${className}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
});

OptimizedActionButton.displayName = 'OptimizedActionButton';

// Célula de tabela otimizada
interface TableCellProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const OptimizedTableCell = memo(({ children, className = '', align = 'left' }: TableCellProps) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  return (
    <td className={`px-4 py-3 text-sm text-gray-700 dark:text-slate-300 ${alignClasses[align]} ${className}`}>
      {children}
    </td>
  );
});

OptimizedTableCell.displayName = 'OptimizedTableCell';

// Linha de tabela otimizada
interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const OptimizedTableRow = memo(({ children, className = '', onClick }: TableRowProps) => {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
});

OptimizedTableRow.displayName = 'OptimizedTableRow';

// Campo de input otimizado
interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'email' | 'password';
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  className?: string;
}

export const OptimizedInputField = memo(({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  placeholder = '',
  disabled = false,
  error = '',
  required = false,
  className = ''
}: InputFieldProps) => {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 transition-all ${
          error 
            ? 'border-red-500 dark:border-red-400' 
            : 'border-gray-300 dark:border-slate-600'
        } ${disabled ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' : ''}`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <Icons.AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
});

OptimizedInputField.displayName = 'OptimizedInputField';

// Select/Combobox otimizado
interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  className?: string;
}

export const OptimizedSelectField = memo(({ 
  label, 
  value, 
  onChange, 
  options,
  placeholder = 'Selecione...',
  disabled = false,
  error = '',
  required = false,
  className = ''
}: SelectFieldProps) => {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 transition-all ${
          error 
            ? 'border-red-500 dark:border-red-400' 
            : 'border-gray-300 dark:border-slate-600'
        } ${disabled ? 'bg-gray-100 dark:bg-slate-700 cursor-not-allowed' : ''}`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <Icons.AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
});

OptimizedSelectField.displayName = 'OptimizedSelectField';

// Card otimizado
interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const OptimizedCard = memo(({ 
  children, 
  title, 
  subtitle, 
  icon, 
  className = '',
  onClick 
}: CardProps) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {(title || icon) && (
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              {icon}
            </div>
          )}
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
});

OptimizedCard.displayName = 'OptimizedCard';

// Checkbox otimizado
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const OptimizedCheckbox = memo(({ 
  label, 
  checked, 
  onChange, 
  disabled = false,
  className = ''
}: CheckboxProps) => {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
      />
      <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
    </label>
  );
});

OptimizedCheckbox.displayName = 'OptimizedCheckbox';

// Spinner/Loading otimizado
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OptimizedLoadingSpinner = memo(({ size = 'md', className = '' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  };

  return (
    <div className={`${sizeClasses[size]} border-blue-600 border-t-transparent rounded-full animate-spin ${className}`} />
  );
});

OptimizedLoadingSpinner.displayName = 'OptimizedLoadingSpinner';

// Empty state otimizado
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const OptimizedEmptyState = memo(({ 
  icon, 
  title, 
  description, 
  action,
  className = ''
}: EmptyStateProps) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      {icon && (
        <div className="mb-4 text-gray-400 dark:text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center max-w-md mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
});

OptimizedEmptyState.displayName = 'OptimizedEmptyState';
