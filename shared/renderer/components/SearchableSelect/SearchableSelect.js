/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import {
  Button,
  Box,
  Flex,
  Text,
  TextField,
  Theme,
  Spinner,
} from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon';
import Portal from '../Portal';

import s from './SearchableSelect.css';

/**
 * SearchableSelect - A dropdown with search, infinite scroll, and multi-select baked by Radix Themes Text/Flex
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
  size = '2',
  renderOption,
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
  const menuRef = useRef(null);
  const debounceTimer = useRef(null);

  // Dynamic positioning for Portal
  const updatePosition = useCallback(() => {
    if (!containerRef.current || !isOpen || !menuRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Check if dropdown would go off bottom of screen
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 300; // estimated max height
    const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

    const menu = menuRef.current;
    menu.style.position = 'fixed';
    menu.style.top = openUpwards ? 'auto' : `${rect.bottom + 4}px`;
    menu.style.bottom = openUpwards
      ? `${window.innerHeight - rect.top + 4}px`
      : 'auto';
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.zIndex = '99999';
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Use capture phase to catch scrolls even on overflowing divs
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  // Normalize value to array for consistent comparisons
  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value != null ? [value] : [];
  }, [value, multiple]);

  const hasValue = selectedValues.length > 0 && selectedValues[0] !== '';

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
    if (!selectedOption) return null;
    return selectedOption.label;
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
        !containerRef.current.contains(event.target) &&
        (!menuRef.current || !menuRef.current.contains(event.target))
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
    <Box
      className={clsx(className, s.container, {
        [s.containerDisabled]: disabled,
      })}
      ref={containerRef}
    >
      <Flex
        align='center'
        justify='between'
        onClick={handleToggle}
        role='button'
        tabIndex={disabled ? -1 : 0}
        aria-label={displayText || displayPlaceholder}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        onKeyDown={handleKeyDown}
        className={clsx(s.trigger, {
          [s.triggerOpen]: isOpen,
          [s.triggerDisabled]: disabled,
        })}
      >
        <Text
          size={size}
          className={displayText ? s.textValue : s.textPlaceholder}
        >
          {displayText || displayPlaceholder}
        </Text>
        <Flex align='center' gap='1' className={s.triggerIcons}>
          {showClearButton && (
            <Button
              variant='ghost'
              color='gray'
              size='1'
              onClick={handleClear}
              title={t(
                'shared:components.searchableSelect.clearSelection',
                'Clear selection',
              )}
              className={s.clearButton}
            >
              ×
            </Button>
          )}
          <Box className={s.chevronBox}>
            <Icon
              name={isOpen ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={16}
            />
          </Box>
        </Flex>
      </Flex>

      {isOpen && (
        <Portal>
          <Theme>
            <Box
              ref={node => {
                menuRef.current = node;
                if (node && isOpen) {
                  // Small delay to ensure DOM is fully painted before measuring
                  requestAnimationFrame(() => updatePosition());
                }
              }}
              className={s.menuContainer}
            >
              {showSearch && (
                <Box px='2' pb='2'>
                  <TextField.Root
                    ref={inputRef}
                    size={size}
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder={displaySearchPlaceholder}
                    onKeyDown={e => e.key === 'Escape' && setIsOpen(false)}
                    onClick={e => e.stopPropagation()}
                  >
                    <TextField.Slot>
                      <Icon name='MagnifyingGlassIcon' size={14} />
                    </TextField.Slot>
                    {loading && (
                      <TextField.Slot>
                        <Spinner size='1' />
                      </TextField.Slot>
                    )}
                  </TextField.Root>
                </Box>
              )}
              <Box
                ref={optionsListRef}
                className={s.optionsList}
                onScroll={handleScroll}
                role='listbox'
                aria-multiselectable={multiple}
              >
                {loading && !filteredOptions.length ? (
                  <Box p='3' className={s.messageBox}>
                    <Text size={size}>
                      {t(
                        'shared:components.searchableSelect.loading',
                        'Loading...',
                      )}
                    </Text>
                  </Box>
                ) : filteredOptions.length > 0 ? (
                  <>
                    {filteredOptions.map(option => {
                      const optSelected = isSelected(option.value);
                      return (
                        <Flex
                          as='li'
                          key={option.value}
                          role='option'
                          tabIndex={0}
                          aria-selected={optSelected}
                          align='center'
                          gap='2'
                          onClick={() => handleSelect(option.value)}
                          onKeyDown={e =>
                            e.key === 'Enter' && handleSelect(option.value)
                          }
                          className={clsx(s.optionItem, {
                            [s.optionItemSelected]: optSelected,
                          })}
                        >
                          {multiple && (
                            <Box
                              className={
                                optSelected
                                  ? s.optionIconSelected
                                  : s.optionIcon
                              }
                            >
                              <Icon
                                name={
                                  optSelected
                                    ? 'CheckCircledIcon'
                                    : 'CircleIcon'
                                }
                                size={16}
                              />
                            </Box>
                          )}
                          <Text size={size} className={s.optionText}>
                            {renderOption ? renderOption(option) : option.label}
                          </Text>
                        </Flex>
                      );
                    })}
                    {loadingMore && (
                      <Box p='2' className={s.messageBox}>
                        <Text size='1'>
                          {t(
                            'shared:components.searchableSelect.loadingMore',
                            'Loading more...',
                          )}
                        </Text>
                      </Box>
                    )}
                    {!loadingMore && hasMore && (
                      <Box p='2' className={s.messageBox}>
                        <Text size='1'>
                          {t(
                            'shared:components.searchableSelect.scrollForMore',
                            'Scroll for more',
                          )}
                        </Text>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box p='3' className={s.messageBox}>
                    <Text size={size}>
                      {t(
                        'shared:components.searchableSelect.noOptions',
                        'No options found',
                      )}
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          </Theme>
        </Portal>
      )}
    </Box>
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
  renderOption: PropTypes.func,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  debounceMs: PropTypes.number,
  size: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default SearchableSelect;
