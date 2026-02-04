import { useState, useRef, InputHTMLAttributes } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses } from '../utils/themeHelpers';
import { normalizarDataInput } from '../utils/dateInput';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  error?: string;
  className?: string;
  containerClassName?: string;
}

export default function Input({
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
}: InputProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const inputType =
    props.type === 'date' && placeholder?.includes('DD/MM/YYYY')
      ? 'text'
      : props.type;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (inputType === 'text' && placeholder?.includes('DD/MM/YYYY')) {
      e.target.value = normalizarDataInput(e.target.value);
    }
    props.onChange?.(e);
  };

  return (
    <div className={`relative mb-2 ${containerClassName}`}>
      {/* Borda */}
      <div
        className={`
          relative
          rounded-md
          border
          px-3
          pt-2
          pb-2
          transition-colors
          duration-150
          bg-white
          dark:bg-slate-900
          ${error
            ? 'border-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-slate-600'
          }
        `}
      >
        {/* Label fake-cut */}
        <label
          className={`
            absolute
            left-3
            -top-2
            px-1
            text-[11px]
            font-medium
            pointer-events-none
            transition-colors
            bg-white
            dark:bg-slate-900
            ${error
              ? 'text-red-500 dark:text-red-400'
              : 'text-slate-500 dark:text-slate-400'
            }
          `}
        >
          {label}
          {props.required && (
            <span className="ml-1 text-red-500 dark:text-red-400">*</span>
          )}
        </label>

        {/* Input */}
        <input
          {...props}
          ref={inputRef}
          value={value !== undefined ? value : defaultValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={
            inputType === 'text' && placeholder?.includes('DD/MM/YYYY')
              ? handleDateChange
              : props.onChange
          }
          disabled={disabled}
          placeholder={placeholder}
          type={inputType}
          className={`
            w-full
            px-0
            py-0.5
            text-sm
            leading-tight
            bg-transparent
            border-0
            outline-none
            text-gray-900
            dark:text-slate-100
            placeholder:text-gray-400
            dark:placeholder:text-slate-500
            disabled:cursor-not-allowed
            ${className}
          `}
        />
      </div>

      {/* Erro */}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
