import { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  className?: string;
  contentClassName?: string;
  arrowClassName?: string;
  disabled?: boolean;
}

export const Tooltip = ({
  content,
  children,
  position = 'top',
  delay = 300,
  variant = 'default',
  className,
  contentClassName,
  arrowClassName,
  disabled = false,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimer(timeout);
  };

  const hideTooltip = () => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  const arrowPositionClasses = {
    top: 'bottom-0 left-1/2 transform -translate-x-1/2 rotate-180',
    bottom: 'top-0 left-1/2 transform -translate-x-1/2',
    left: 'right-0 top-1/2 transform -translate-y-1/2 rotate-90',
    right: 'left-0 top-1/2 transform -translate-y-1/2 -rotate-90',
  };

  const variantClasses = {
    default: 'bg-gray-900 text-white',
    info: 'bg-blue-900 text-white',
    success: 'bg-green-900 text-white',
    warning: 'bg-yellow-900 text-white',
    danger: 'bg-red-900 text-white',
  };

  return (
    <div
      className={cn('relative inline-block group', className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <>
          <div
            className={cn(
              'absolute z-50 px-2.5 py-1.5 text-xs font-medium rounded-lg shadow-lg transition-opacity duration-200',
              positionClasses[position],
              variantClasses[variant],
              contentClassName
            )}
            role="tooltip"
          >
            {content}
          </div>
          <div
            className={cn(
              'absolute z-50 w-2 h-2 border-0',
              arrowPositionClasses[position],
              arrowClassName
            )}
          >
            <div
              className={cn(
                'w-0 h-0 border-4 border-transparent',
                variant === 'default' && 'border-t-gray-900',
                variant === 'info' && 'border-t-blue-900',
                variant === 'success' && 'border-t-green-900',
                variant === 'warning' && 'border-t-yellow-900',
                variant === 'danger' && 'border-t-red-900',
              )}
            />
          </div>
        </>
      )}
    </div>
  );
};
