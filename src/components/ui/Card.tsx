import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'outlined' | 'elevated' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  interactive?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

const variantClasses = {
  default: 'card',
  outlined: 'card border-2',
  elevated: 'card shadow-medium hover:shadow-strong transform hover:-translate-y-1',
  ghost: 'bg-transparent shadow-none border-none',
  glass: 'glass hover:glass-strong transform hover:-translate-y-1',
  'glass-dark': 'glass-dark hover:glass-strong-dark transform hover:-translate-y-1',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    children, 
    variant = 'default', 
    padding = 'md', 
    hover = true,
    interactive = false,
    className,
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          paddingClasses[padding],
          hover && 'hover:-translate-y-1',
          interactive && 'cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  bordered?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, bordered = true, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'card-header',
          !bordered && 'border-b-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Body
export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('card-body', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// Card Footer
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  bordered?: boolean;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, bordered = true, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'card-footer',
          !bordered && 'border-t-0 bg-transparent',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// Card Title
export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, level = 3, className, ...props }, ref) => {
    const Tag = (`h${level}`) as any;
    
  return (
      <Tag
        ref={ref}
        className={cn(
          'text-lg font-semibold text-secondary-900 dark:text-secondary-100',
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);

CardTitle.displayName = 'CardTitle';

// Card Description
export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          'text-sm text-secondary-600 dark:text-secondary-400 mt-1',
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';
