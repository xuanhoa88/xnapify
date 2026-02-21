/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import Button from '../Button';
import s from './SearchableSelect.css';

/**
 * SearchableSelect - A dropdown with search, infinite scroll, and multi-select
 *
 * Features:
 * - Local search: Filters options client-side (default)
 * - Async search: Calls onSearch for API-based search
 * - Infinite scroll: Calls onLoadMore when scrolling near bottom
 * - Multi-select: value is array, shows count badge
 * - Clearable: Shows clear button to reset selection
 */
function SearchableSelect({
  options = [],
  value,
  onChange,
  onSearch,
  onLoadMore,
  className,
  disabled = false,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  debounceMs = 300,
  loading = false,
  loadingMore = false,
  hasMore = false,
  multiple = false,
  showSearch = true,
  clearable = false,
}) {
  const { t } = useTranslation();

  const displayPlaceholder =
    placeholder ||
    t('shared:components.searchableSelect.placeholder', 'Select...');
  const displaySearchPlaceholder =
    searchPlaceholder ||
    t('shared:components.searchableSelect.searchPlaceholder', 'Search...');

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionsListRef = useRef(null);
  const debounceTimer = useRef(null);

  // Normalize value to array for consistent comparisons
  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value != null && value !== '' ? [value] : [];
  }, [value, multiple]);

  // Check if there's a value to clear
  const hasValue = selectedValues.length > 0;

  // Get display text
  const displayText = useMemo(() => {
    if (!hasValue) return null;
    if (multiple) {
      if (selectedValues.length === 1) {
        const opt = options.find(o => o.value === selectedValues[0]);
        return (
          (opt && opt.label) ||
          t('shared:components.searchableSelect.oneSelected', '1 selected')
        );
      }
      return t(
        'shared:components.searchableSelect.multipleSelected',
        '{{count}} selected',
        { count: selectedValues.length },
      );
    }
    const selectedOption = options.find(opt => opt && opt.value === value);
    return (selectedOption && selectedOption.label) || null;
  }, [hasValue, multiple, selectedValues, options, value, t]);

  // Check if an option is selected
  const isSelected = useCallback(
    optionValue => selectedValues.includes(optionValue),
    [selectedValues],
  );

  // Filter options (local mode only - async mode uses pre-filtered options)
  const filteredOptions = useMemo(() => {
    if (onSearch) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(term));
  }, [onSearch, options, searchTerm]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const list = optionsListRef.current;
    if (!list || !onLoadMore || !hasMore || loadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = list;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loadingMore]);

  // Toggle dropdown
  const handleToggle = useCallback(() => {
    if (disabled) return;

    const opening = !isOpen;
    setIsOpen(opening);

    if (opening) {
      setSearchTerm('');
      if (typeof onSearch === 'function') {
        onSearch('');
      }
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    }
  }, [disabled, isOpen, onSearch]);

  // Handle keyboard on control
  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchTerm('');
      }
    },
    [handleToggle, isOpen],
  );

  // Search input change
  const handleSearchChange = useCallback(
    e => {
      const term = e.target.value;
      setSearchTerm(term);

      if (onSearch) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => onSearch(term), debounceMs);
      }
    },
    [onSearch, debounceMs],
  );

  // Select an option
  const handleSelect = useCallback(
    optionValue => {
      if (multiple) {
        const newValues = isSelected(optionValue)
          ? selectedValues.filter(v => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange(newValues);
      } else {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
      }
    },
    [multiple, isSelected, selectedValues, onChange],
  );

  // Clear selection (works for both single and multi-select)
  const handleClear = useCallback(
    e => {
      e.stopPropagation();
      onChange(multiple ? [] : '');
    },
    [onChange, multiple],
  );

  // Show clear button when clearable and has value
  const showClearButton = (clearable || multiple) && hasValue;

  return (
    <div
      className={clsx(s.container, className, {
        [s.disabled]: disabled,
        [s.open]: isOpen,
      })}
      ref={containerRef}
    >
      <div
        className={s.control}
        onClick={handleToggle}
        role='button'
        tabIndex={disabled ? -1 : 0}
        aria-label={displayText || displayPlaceholder}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        onKeyDown={handleKeyDown}
      >
        <span className={clsx(s.value, { [s.placeholder]: !displayText })}>
          {displayText || displayPlaceholder}
        </span>
        <div className={s.controlRight}>
          {showClearButton && (
            <Button
              variant='ghost'
              size='small'
              iconOnly
              className={s.clearBtn}
              onClick={handleClear}
              title={t(
                'shared:components.searchableSelect.clearSelection',
                'Clear selection',
              )}
            >
              <Icon name='close' size={12} />
            </Button>
          )}
          <span className={s.arrow} />
        </div>
      </div>

      {isOpen && (
        <div className={s.menu}>
          {showSearch && (
            <div className={s.searchContainer}>
              <input
                ref={inputRef}
                type='text'
                className={s.searchInput}
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={displaySearchPlaceholder}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.key === 'Escape' && setIsOpen(false)}
              />
              {loading && (
                <Icon name='loader' size={16} className={s.loadingIndicator} />
              )}
            </div>
          )}
          <ul
            ref={optionsListRef}
            className={s.optionsList}
            onScroll={handleScroll}
            role='listbox'
            aria-multiselectable={multiple}
          >
            {loading ? (
              <li className={s.noOptions}>
                {t('shared:components.searchableSelect.loading', 'Loading...')}
              </li>
            ) : filteredOptions.length > 0 ? (
              <>
                {filteredOptions.map(option => {
                  const optSelected = isSelected(option.value);
                  return (
                    <li
                      key={option.value}
                      role='option'
                      tabIndex={0}
                      aria-selected={optSelected}
                      className={clsx(s.option, { [s.selected]: optSelected })}
                      onClick={() => handleSelect(option.value)}
                      onKeyDown={e =>
                        e.key === 'Enter' && handleSelect(option.value)
                      }
                    >
                      {multiple && (
                        <span className={s.checkbox}>
                          <Icon
                            name={optSelected ? 'check-circle' : 'circle'}
                            size={16}
                          />
                        </span>
                      )}
                      <span className={s.optionLabel}>{option.label}</span>
                    </li>
                  );
                })}
                {loadingMore && (
                  <li className={s.loadingMore}>
                    {t(
                      'shared:components.searchableSelect.loadingMore',
                      'Loading more...',
                    )}
                  </li>
                )}
                {!loadingMore && hasMore && (
                  <li className={s.loadMoreHint}>
                    {t(
                      'shared:components.searchableSelect.scrollForMore',
                      'Scroll for more',
                    )}
                  </li>
                )}
              </>
            ) : (
              <li className={s.noOptions}>
                {t(
                  'shared:components.searchableSelect.noOptions',
                  'No options found',
                )}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

SearchableSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    ),
  ]),
  onChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func,
  onLoadMore: PropTypes.func,
  hasMore: PropTypes.bool,
  loading: PropTypes.bool,
  loadingMore: PropTypes.bool,
  multiple: PropTypes.bool,
  showSearch: PropTypes.bool,
  clearable: PropTypes.bool,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  debounceMs: PropTypes.number,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default SearchableSelect;
