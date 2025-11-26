import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant =
| 'primary'
| 'secondary'
| 'outline'
| 'ghost'
| 'danger'
| 'success'
| 'warning';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
variant?: ButtonVariant;
size?: ButtonSize;
loading?: boolean;
icon?: ReactNode;
iconPosition?: 'left' | 'right';
fullWidth?: boolean;
rounded?: boolean;
children: ReactNode;
}

const sizeClasses = {
xs: 'px-2.5 py-1.5 text-xs',
sm: 'px-3 py-2 text-sm',
md: 'px-4 py-2.5 text-sm',
lg: 'px-6 py-3 text-base',
xl: 'px-8 py-4 text-lg',
};

const variantClasses = {
  primary: 'btn-primary shadow-soft hover:shadow-medium active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
  secondary: 'btn-secondary shadow-soft hover:shadow-medium active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
  outline: 'btn-outline shadow-soft hover:shadow-medium active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
  ghost: 'btn-ghost hover:shadow-soft active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
  danger: 'btn-danger shadow-soft hover:shadow-medium active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
  success: 'btn-success shadow-soft hover:shadow-medium active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
  warning: 'bg-warning text-white hover:bg-yellow-600 focus:ring-yellow-500 shadow-soft hover:shadow-medium active:shadow-sm transform hover:-translate-y-0.5 active:translate-y-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
({
variant = 'primary',
size = 'md',
loading = false,
icon,
iconPosition = 'left',
fullWidth = false,
rounded = false,
className,
children,
disabled,
'aria-label': ariaLabel,
...props
}, ref) => {
const isDisabled = disabled || loading;

return (
  <button
    ref={ref}
    className={cn(
      'btn',
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && 'w-full',
      rounded && 'rounded-full',
      loading && 'relative cursor-wait',
      className
    )}
    disabled={isDisabled}
    aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
    aria-busy={loading}
    aria-disabled={isDisabled}
    {...props}
  >
    {loading && (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none motion-reduce:hidden" />
      </div>
    )}
    
    <div className={cn(
      'flex items-center gap-2',
      loading && 'opacity-0'
    )}>
      {icon && iconPosition === 'left' && (
        <span className="flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className="flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
    </div>
  </button>
);

}
);

Button.displayName = 'Button';

// Icon Button Component
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
icon: ReactNode;
variant?: ButtonVariant;
size?: 'sm' | 'md' | 'lg';
loading?: boolean;
tooltip?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
({ icon, variant = 'ghost', size = 'md', loading, tooltip, className, ...props }, ref) => {
const sizeClasses = {
sm: 'p-2',
md: 'p-2.5',
lg: 'p-3',
};

return (
  <div className="relative group">
    <button
      ref={ref}
      className={cn(
        'btn',
        variantClasses[variant],
        sizeClasses[size],
        'rounded-full',
        loading && 'relative',
        className
      )}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
    </button>
    {tooltip && (
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {tooltip}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
      </div>
    )}
  </div>
);

}
);

IconButton.displayName = 'IconButton';
