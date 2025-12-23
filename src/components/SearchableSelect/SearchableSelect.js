/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import Icon from '../Icon';
import s from './SearchableSelect.css';

/**
 * SearchableSelect - A dropdown with search, infinite scroll, and multi-select
 *
 * Supports:
 * 1. Local search (default): Filters pre-loaded options client-side
 * 2. Async search: Calls onSearch callback for API-based search
 * 3. Infinite scroll: Calls onLoadMore when scrolling near bottom
 * 4. Multi-select: When multiple=true, value is an array and shows count
 *
 * Props:
 * - options: Array of { value, label } objects
 * - value: Currently selected value (string/number) or array when multiple=true
 * - onChange: Callback when selection changes
 * - multiple: Enable multi-select mode
 * - onSearch: Optional callback for async search (receives search term)
 * - onLoadMore: Optional callback to load more items (infinite scroll)
 * - hasMore: Boolean indicating if more items can be loaded
 * - loading: Loading state for initial search
 * - loadingMore: Loading state for infinite scroll
 * - placeholder: Placeholder text
 * - searchPlaceholder: Placeholder for search input
 * - debounceMs: Debounce delay for async search (default: 300ms)
 */
function SearchableSelect({
  options,
  value,
  onChange,
  onSearch,
  onLoadMore,
  className,
  disabled,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  debounceMs = 300,
  loading = false,
  loadingMore = false,
  hasMore = false,
  multiple = false,
  showSearch = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionsListRef = useRef(null);
  const debounceTimer = useRef(null);

  // Normalize value to array for multi-select comparisons
  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value !== undefined && value !== null && value !== '' ? [value] : [];
  }, [value, multiple]);

  // Find selected option for single select display
  const selectedOption = useMemo(() => {
    if (multiple) return null;
    return options.find(opt => opt.value === value);
  }, [options, value, multiple]);

  // Get display text
  const displayText = useMemo(() => {
    if (multiple) {
      const count = selectedValues.length;
      if (count === 0) return null;
      if (count === 1) {
        const opt = options.find(o => o.value === selectedValues[0]);
        return opt ? opt.label : '1 selected';
      }
      return `${count} selected`;
    }
    return selectedOption ? selectedOption.label : null;
  }, [multiple, selectedValues, selectedOption, options]);

  // Check if an option is selected
  const isSelected = useCallback(
    optionValue => selectedValues.includes(optionValue),
    [selectedValues],
  );

  // For local search mode, filter options client-side
  // For async search mode, options are already filtered by parent
  const filteredOptions = useMemo(
    () =>
      onSearch
        ? options
        : options.filter(opt =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
    [onSearch, options, searchTerm],
  );

  const handleClickOutside = useCallback(event => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      setIsOpen(false);
      setSearchTerm('');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!optionsListRef.current || !onLoadMore || !hasMore || loadingMore) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = optionsListRef.current;
    // Load more when scrolled to within 50px of bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loadingMore]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
        // Trigger initial search for async mode
        if (onSearch) {
          onSearch('');
        }
        // Focus search input slightly after open
        setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
      }
    }
  }, [disabled, isOpen, onSearch]);

  const handleSearchChange = useCallback(
    e => {
      const newSearchTerm = e.target.value;
      setSearchTerm(newSearchTerm);

      // If async search mode, debounce and call onSearch
      if (onSearch) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
          onSearch(newSearchTerm);
        }, debounceMs);
      }
    },
    [onSearch, debounceMs],
  );

  const handleSelect = useCallback(
    optionValue => {
      if (multiple) {
        // Toggle selection for multi-select
        const newValues = isSelected(optionValue)
          ? selectedValues.filter(v => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange(newValues);
        // Don't close menu in multi-select mode
      } else {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
      }
    },
    [multiple, isSelected, selectedValues, onChange],
  );

  // Clear all selections (for multi-select)
  const handleClearAll = useCallback(
    e => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange],
  );

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
        tabIndex={0}
        aria-label={displayText || placeholder}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <span className={clsx(s.value, { [s.placeholder]: !displayText })}>
          {displayText || placeholder}
        </span>
        <div className={s.controlRight}>
          {multiple && selectedValues.length > 0 && (
            <button
              type='button'
              className={s.clearBtn}
              onClick={handleClearAll}
              title='Clear all'
            >
              <Icon name='close' size={12} />
            </button>
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
                placeholder={searchPlaceholder}
                onClick={e => e.stopPropagation()}
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
              <li className={s.noOptions}>Loading...</li>
            ) : filteredOptions.length > 0 ? (
              <>
                {filteredOptions.map(option => {
                  const optSelected = isSelected(option.value);
                  return (
                    <li
                      aria-selected={optSelected}
                      role='option'
                      tabIndex={0}
                      key={option.value}
                      className={clsx(s.option, {
                        [s.selected]: optSelected,
                      })}
                      onClick={() => handleSelect(option.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleSelect(option.value);
                        }
                      }}
                    >
                      {multiple && (
                        <span className={s.checkbox}>
                          {optSelected ? (
                            <Icon name='check-circle' size={16} />
                          ) : (
                            <Icon name='circle' size={16} />
                          )}
                        </span>
                      )}
                      <span className={s.optionLabel}>{option.label}</span>
                    </li>
                  );
                })}
                {loadingMore && (
                  <li className={s.loadingMore}>Loading more...</li>
                )}
                {!loadingMore && hasMore && (
                  <li className={s.loadMoreHint}>Scroll for more</li>
                )}
              </>
            ) : (
              <li className={s.noOptions}>No options found</li>
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
  ).isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    ),
  ]),
  onChange: PropTypes.func.isRequired,
  multiple: PropTypes.bool, // Enable multi-select mode
  showSearch: PropTypes.bool, // Show/hide search input
  onSearch: PropTypes.func, // Optional: for async search mode
  onLoadMore: PropTypes.func, // Optional: for infinite scroll
  hasMore: PropTypes.bool, // Optional: indicates more items available
  loading: PropTypes.bool, // Optional: loading state for initial search
  loadingMore: PropTypes.bool, // Optional: loading state for infinite scroll
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  debounceMs: PropTypes.number,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default SearchableSelect;
