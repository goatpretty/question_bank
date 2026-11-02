import { ReactNode, useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface Option {
  value: string | number;
  label: string | ReactNode;
  disabled?: boolean;
  group?: string;
}

interface SelectProps {
  options: Option[];
  value: string | number | (string | number)[];
  onChange: (value: string | number | (string | number)[]) => void;
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  optionClassName?: string;
  labelClassName?: string;
  error?: string;
  maxHeight?: number;
  loading?: boolean;
  noOptionsMessage?: string;
}

export const Select = ({
  options,
  value,
  onChange,
  placeholder = '请选择',
  multiple = false,
  searchable = false,
  disabled = false,
  required: _required = false,
  className,
  optionClassName,
  labelClassName,
  error,
  maxHeight = 300,
  loading = false,
  noOptionsMessage = '没有找到匹配的选项',
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Group options by group name
  const groupedOptions = options.reduce<Record<string, Option[]>>((acc, option) => {
    const group = option.group || 'default';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(option);
    return acc;
  }, {});

  // Filter options based on search value
  const filteredOptions = options.filter(option => {
    if (!searchValue) return true;
    const label = typeof option.label === 'string' ? option.label : '';
    return label.toLowerCase().includes(searchValue.toLowerCase());
  });

  // Get selected options
  const selectedOptions = Array.isArray(value)
    ? options.filter(option => value.includes(option.value))
    : [options.find(option => option.value === value)].filter(Boolean);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleOptionClick(filteredOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, highlightedIndex, filteredOptions, multiple, value, onChange]);

  const handleOptionClick = (optionValue: string | number) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = currentValue.includes(optionValue)
        ? currentValue.filter(v => v !== optionValue)
        : [...currentValue, optionValue];
      onChange(newValue);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  };

  const handleRemoveSelected = (optionValue: string | number) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = currentValue.filter(v => v !== optionValue);
      onChange(newValue);
    }
  };

  return (
    <div className={cn('relative', className)} ref={selectRef}>
      {/* Select Trigger */}
      <div
        className={cn(
          'flex items-center justify-between w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-pointer transition-colors',
          isOpen && 'border-primary-500 dark:border-primary-400 ring-1 ring-primary-500 dark:ring-primary-400',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-500 dark:border-red-400 ring-1 ring-red-500 dark:ring-red-400'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {/* Selected Values */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {selectedOptions.length > 0 ? (
            selectedOptions.map(option => (
              <div
                key={option.value}
                className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 text-xs rounded-full"
              >
                <span>{typeof option.label === 'string' ? option.label : '选项'}</span>
                {multiple && (
                  <button
                    type="button"
                    className="text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSelected(option.value);
                    }}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 10 10">
                      <path d="M8.5 1.5L1.5 8.5M1.5 1.5L8.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">{placeholder}</span>
          )}
        </div>

        {/* Arrow Icon */}
        <div className="flex items-center justify-center w-6 h-6 text-gray-500 dark:text-gray-400 transition-transform">
          <svg
            className={cn('w-4 h-4', isOpen && 'transform rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Search Input */}
      {isOpen && searchable && (
        <div className="absolute inset-x-0 top-0 z-10 p-1 bg-white dark:bg-gray-800 rounded-t-lg border border-b-0 border-gray-300 dark:border-gray-600 shadow-sm">
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="搜索选项..."
            className="w-full p-2.5 text-sm border-none rounded-lg focus:outline-none focus:ring-0"
            autoFocus
          />
        </div>
      )}

      {/* Options Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden"
          style={{ maxHeight }}
        >
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          )}

          {/* No Options */}
          {!loading && filteredOptions.length === 0 && (
            <div className="p-4 text-gray-500 dark:text-gray-400 text-center">
              {noOptionsMessage}
            </div>
          )}

          {/* Options List */}
          {!loading && filteredOptions.length > 0 && (
            <div className="max-h-full overflow-y-auto">
              {Object.entries(groupedOptions).map(([groupName, groupOptions]) => {
                const filteredGroupOptions = groupOptions.filter(option => {
                  if (!searchValue) return true;
                  const label = typeof option.label === 'string' ? option.label : '';
                  return label.toLowerCase().includes(searchValue.toLowerCase());
                });

                if (filteredGroupOptions.length === 0) return null;

                return (
                  <div key={groupName}>
                    {/* Group Header */}
                    {groupName !== 'default' && (
                      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                        {groupName}
                      </div>
                    )}
                    {/* Group Options */}
                    {filteredGroupOptions.map((option, index) => {
                      const isSelected = Array.isArray(value)
                        ? value.includes(option.value)
                        : value === option.value;
                      const isHighlighted = highlightedIndex === index;

                      return (
                        <div
                          key={option.value}
                          className={cn(
                            'flex items-center px-4 py-3 text-sm cursor-pointer transition-colors',
                            isSelected && 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200',
                            isHighlighted && !isSelected && 'bg-gray-100 dark:bg-gray-700',
                            option.disabled && 'opacity-50 cursor-not-allowed',
                            optionClassName
                          )}
                          onClick={() => !disabled && !option.disabled && handleOptionClick(option.value)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          {/* Checkbox */}
                          <div className="flex-shrink-0 w-5 h-5 mr-3 border border-gray-300 dark:border-gray-600 rounded transition-colors">
                            {isSelected && (
                              <svg
                                className="w-4 h-4 text-primary-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          {/* Option Label */}
                          <div className={cn('flex-1', labelClassName)}>
                            {option.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-1 text-xs text-red-500 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};
