import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type InputVariant = 'default' | 'filled' | 'outlined' | 'ghost';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
  labelClassName?: string;
}

const sizeClasses = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-4 py-3 text-base',
  xl: 'px-5 py-4 text-lg',
};

const variantClasses = {
  default: 'form-input',
  filled: 'bg-secondary-100 border-transparent focus:bg-white',
  outlined: 'bg-white border-2 focus:border-2',
  ghost: 'border-transparent bg-transparent focus:bg-white',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    size = 'md', 
    variant = 'default',
    label, 
    error, 
    helperText, 
    leftIcon, 
    rightIcon, 
    fullWidth = true,
    className,
    containerClassName,
    labelClassName,
    id,
    'aria-describedby': ariaDescribedby,
    'aria-invalid': ariaInvalid,
    ...props 
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const helperTextId = `${inputId}-helper`;
    const errorTextId = `${inputId}-error`;
    
    // Determine which description to use
    const descriptionId = hasError ? errorTextId : helperText ? helperTextId : undefined;
    
    return (
      <div className={cn('space-y-2', fullWidth && 'w-full', containerClassName)}>
        {label && (
          <label 
            htmlFor={inputId} 
            className={cn('form-label', labelClassName)}
          >
            {label}
            {props.required && <span className="text-error ml-1" aria-label="required">*</span>}
          </label>
        )}
        
        <div className={cn('relative', fullWidth && 'w-full')}>
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <div className={cn(
                'h-5 w-5',
                hasError ? 'text-error' : 'text-secondary-400'
              )} aria-hidden="true">
                {leftIcon}
              </div>
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={cn(
              variantClasses[variant],
              sizeClasses[size],
              fullWidth && 'w-full',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              hasError && 'border-error focus:ring-error focus:border-error',
              variant === 'outlined' && !hasError && 'focus:border-primary-500',
              className
            )}
            aria-describedby={ariaDescribedby || descriptionId}
            aria-invalid={ariaInvalid || hasError}
            aria-required={props.required}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <div className={cn(
                'h-5 w-5',
                hasError ? 'text-error' : 'text-secondary-400'
              )} aria-hidden="true">
                {rightIcon}
              </div>
            </div>
          )}
        </div>
        
        {helperText && !hasError && (
          <p id={helperTextId} className="text-sm text-secondary-500">{helperText}</p>
        )}
        
        {hasError && (
          <p id={errorTextId} className="text-sm text-error" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea Component
export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    size = 'md', 
    variant = 'default',
    label, 
    error, 
    helperText, 
    fullWidth = true,
    className,
    containerClassName,
    labelClassName,
    rows = 4,
    id,
    ...props 
  }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    
    return (
      <div className={cn('space-y-2', fullWidth && 'w-full', containerClassName)}>
        {label && (
          <label 
            htmlFor={textareaId} 
            className={cn('form-label', labelClassName)}
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            variantClasses[variant],
            sizeClasses[size],
            fullWidth && 'w-full',
            'resize-vertical min-h-[100px]',
            hasError && 'border-error focus:ring-error focus:border-error',
            variant === 'outlined' && !hasError && 'focus:border-primary-500',
            className
          )}
          {...props}
        />
        
        {helperText && !hasError && (
          <p className="text-sm text-secondary-500">{helperText}</p>
        )}
        
        {hasError && (
          <p className="text-sm text-error">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Select Component
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  fullWidth?: boolean;
  containerClassName?: string;
  labelClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    size = 'md', 
    variant = 'default',
    label, 
    error, 
    helperText, 
    options,
    placeholder,
    fullWidth = true,
    className,
    containerClassName,
    labelClassName,
    id,
    ...props 
  }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    
    return (
      <div className={cn('space-y-2', fullWidth && 'w-full', containerClassName)}>
        {label && (
          <label 
            htmlFor={selectId} 
            className={cn('form-label', labelClassName)}
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        
        <select
          ref={ref}
          id={selectId}
          className={cn(
            variantClasses[variant],
            sizeClasses[size],
            fullWidth && 'w-full',
            hasError && 'border-error focus:ring-error focus:border-error',
            variant === 'outlined' && !hasError && 'focus:border-primary-500',
            'appearance-none bg-no-repeat bg-right',
            "bg-[url('data:image/svg+xml,%3csvg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 20 20%\%3e%3cpath stroke=\"%236b7280\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"m6 8 4 4 4-4\"/%3e%3c/svg%3e')]",
            "dark:bg-[url('data:image/svg+xml,%3csvg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 20 20%\%3e%3cpath stroke=\"%2394a3b8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"m6 8 4 4 4-4\"/%3e%3c/svg%3e')]",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        
        {helperText && !hasError && (
          <p className="text-sm text-secondary-500">{helperText}</p>
        )}
        
        {hasError && (
          <p className="text-sm text-error">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
