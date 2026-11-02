import { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';

interface TabItem {
  id: string;
  label: string | ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'underline' | 'pills' | 'boxed';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  tabListClassName?: string;
  tabClassName?: string;
  contentClassName?: string;
}

export const Tabs = ({
  tabs,
  defaultValue = tabs[0]?.id,
  onChange,
  variant = 'default',
  orientation = 'horizontal',
  className,
  tabListClassName,
  tabClassName,
  contentClassName,
}: TabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onChange) {
      onChange(tabId);
    }
  };

  const variantClasses = {
    default: 'border-b border-gray-200 dark:border-gray-700',
    underline: 'border-b border-gray-200 dark:border-gray-700',
    pills: 'flex flex-wrap gap-1',
    boxed: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-1',
  };

  const tabVariantClasses = {
    default: {
      base: 'inline-flex items-center justify-center px-4 py-2 text-sm font-medium',
      active: 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400',
      inactive: 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
      disabled: 'opacity-50 cursor-not-allowed',
    },
    underline: {
      base: 'inline-flex items-center justify-center px-4 py-2 text-sm font-medium',
      active: 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400',
      inactive: 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
      disabled: 'opacity-50 cursor-not-allowed',
    },
    pills: {
      base: 'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-colors',
      active: 'bg-primary-600 dark:bg-primary-500 text-white',
      inactive: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600',
      disabled: 'opacity-50 cursor-not-allowed',
    },
    boxed: {
      base: 'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors',
      active: 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm',
      inactive: 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
      disabled: 'opacity-50 cursor-not-allowed',
    },
  };

  const orientationClasses = {
    horizontal: 'flex flex-row',
    vertical: 'flex flex-col w-full',
  };

  const contentOrientationClasses = {
    horizontal: 'mt-4',
    vertical: 'mt-0',
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Tab List */}
      <div
        className={cn(
          orientationClasses[orientation],
          variantClasses[variant],
          tabListClassName
        )}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isDisabled = tab.disabled || false;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              className={cn(
                tabVariantClasses[variant].base,
                isActive ? tabVariantClasses[variant].active : tabVariantClasses[variant].inactive,
                isDisabled && tabVariantClasses[variant].disabled,
                tabClassName
              )}
              onClick={() => !isDisabled && handleTabClick(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className={cn(contentOrientationClasses[orientation], contentClassName)}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            className={cn(
              'transition-opacity duration-200',
              activeTab === tab.id ? 'opacity-100' : 'opacity-0 hidden'
            )}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};
