import { useState, useRef, TextareaHTMLAttributes } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses } from '../utils/themeHelpers';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label: string;
  error?: string;
  className?: string;
  containerClassName?: string;
}

/**
 * Componente Textarea com label na borda (outlined label)
 * Label fica na borda superior, com a borda "cortada" ao redor do texto
 */
export default function Textarea({
  label,
  error,
  className = '',
  containerClassName = '',
  value,
  defaultValue,
  onFocus,
  onBlur,
  disabled,
  placeholder,
  ...props
}: TextareaProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={`relative ${containerClassName}`}>
      <fieldset
        className={`
          relative rounded-md border px-3
          transition-colors duration-200
          ${error
            ? 'border-red-500 dark:border-red-400'
            : isFocused
              ? getThemeClasses(primaryColor, 'border')
              : 'border-gray-300 dark:border-slate-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          bg-transparent
        `}
      >
        <legend
          className={`
            px-1 text-xs font-medium
            transition-colors duration-200
            bg-transparent
            ${error
              ? 'text-red-500 dark:text-red-400'
              : isFocused
                ? getThemeClasses(primaryColor, 'text')
                : 'text-gray-500 dark:text-slate-400'
            }
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          {label}
          {props.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </legend>

        <textarea
          {...props}
          ref={textareaRef}
          value={value !== undefined ? value : defaultValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full px-0 py-1
            text-sm
            bg-transparent
            text-gray-900 dark:text-slate-100
            placeholder:text-gray-400 dark:placeholder:text-slate-500
            focus:outline-none
            disabled:cursor-not-allowed
            resize-none
            ${className}
          `}
        />
      </fieldset>

      {/* Mensagem de erro */}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
