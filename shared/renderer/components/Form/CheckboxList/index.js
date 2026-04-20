/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  forwardRef,
  useRef,
  useCallback,
  useMemo,
  useState,
  useEffect,
  memo,
} from 'react';

import {
  Flex,
  Text,
  Box,
  TextField,
  IconButton,
  Checkbox,
} from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import Icon from '../../Icon';
import { useInfiniteScroll } from '../../InfiniteScroll';
import { useFormField, useMergeRefs } from '../FormContext';

import s from './CheckboxList.css';

/**
 * CheckboxItem - Memoized individual checkbox for better performance
 * Only re-renders when its own props change
 */
const CheckboxItem = memo(function CheckboxItem({
  value,
  label,
  description,
  isChecked,
  name,
  disabled,
  onChange,
}) {
  return (
    <Box
      as='label'
      className={clsx(
        s.checkboxItem,
        disabled ? s.checkboxItemCursorDisabled : s.checkboxItemCursor,
      )}
    >
      <Checkbox
        size='1'
        name={name}
        value={value}
        checked={isChecked}
        onCheckedChange={checked =>
          onChange({ target: { name, value, checked } })
        }
        disabled={disabled}
        className={
          disabled ? s.checkboxItemCursorDisabled : s.checkboxItemCursor
        }
      />
      <Flex direction='column' gap='1' className={s.checkboxFlex1}>
        <Text as='span' size='2' weight='medium' className={s.checkboxLabel}>
          {label}
        </Text>
        {description && (
          <Text as='span' size='1' color='gray' className={s.checkboxDesc}>
            {description}
          </Text>
        )}
      </Flex>
    </Box>
  );
});

CheckboxItem.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  isChecked: PropTypes.bool.isRequired,
  name: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};

/**
 * GroupHeader - Memoized group header with "Select All" checkbox
 * Supports indeterminate state when only some items are selected
 */
const GroupHeader = memo(function GroupHeader({
  groupKey,
  label,
  selectedCount,
  totalCount,
  disabled,
  onToggle,
}) {
  const checkboxRef = useRef(null);
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

  // Set indeterminate property via ref (can't be set via attribute)
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleChange = useCallback(() => {
    onToggle(groupKey, !isAllSelected);
  }, [groupKey, isAllSelected, onToggle]);

  return (
    <Box as='label' className={s.groupHeader}>
      <Checkbox
        size='1'
        checked={
          isAllSelected ? true : isIndeterminate ? 'indeterminate' : false
        }
        onCheckedChange={handleChange}
        disabled={disabled}
        className={
          disabled ? s.checkboxItemCursorDisabled : s.checkboxItemCursor
        }
      />
      <Text as='span' size='2' weight='bold' className={s.groupHeaderLabel}>
        {label}
      </Text>
      <Text as='span' size='1' color='gray'>
        ({selectedCount}/{totalCount})
      </Text>
    </Box>
  );
});

GroupHeader.propTypes = {
  groupKey: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  selectedCount: PropTypes.number.isRequired,
  totalCount: PropTypes.number.isRequired,
  disabled: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};

/**
 * FormCheckboxList - Multi-select checkbox list with search, grouping, and infinite scroll
 *
 * Performance optimizations:
 * - Memoized CheckboxItem component to prevent unnecessary re-renders
 * - Memoized getters and grouped items
 * - Stable callback references with useCallback
 * - Set-based lookup for O(1) checked state instead of Array.includes O(n)
 *
 * Usage:
 *   <Form.Field name="roles" label="Roles">
 *     <Form.CheckboxList
 *       items={roles}
 *       loading={rolesLoading}
 *       hasMore={rolesHasMore}
 *       onLoadMore={handleLoadMoreRoles}
 *       searchable
 *       onSearch={setRoleSearch}
 *       searchPlaceholder="Search roles..."
 *       valueKey="name"
 *       labelKey="name"
 *     />
 *   </Form.Field>
 *
 * With grouping (for permissions):
 *   <Form.Field name="permissions" label="Permissions">
 *     <Form.CheckboxList
 *       items={permissions}
 *       valueKey="id"
 *       labelKey="description"
 *       groupBy="resource"
 *     />
 *   </Form.Field>
 */
const FormCheckboxList = forwardRef(function FormCheckboxList$(
  {
    items = [],
    loading = false,
    loadingMore = false,
    hasMore = false,
    onLoadMore,
    // Search props
    searchable = false,
    searchValue,
    onSearch,
    searchPlaceholder = 'Search...',
    // Item key props
    valueKey = 'id',
    labelKey = 'name',
    descriptionKey,
    // Legacy naming support
    itemKey,
    itemLabel,
    itemDescription,
    // Grouping
    groupBy,
    groupLabelFormatter,
    // Messages
    emptyMessage = 'No items found',
    loadingMessage = 'Loading...',
    // Dimensions
    maxHeight = 320,
    minHeight = 160,
    size = '3',
    // Other
    className,
    disabled,
  },
  forwardedRef,
) {
  const { t } = useTranslation();

  const displayEmptyMessage =
    emptyMessage || t('shared:components.checkboxList.empty', 'No items found');
  const displayLoadingMessage =
    loadingMessage || t('shared:components.checkboxList.loading', 'Loading...');
  const displaySearchPlaceholder =
    searchPlaceholder ||
    t('shared:components.checkboxList.searchPlaceholder', 'Search...');

  const { id, name, error } = useFormField();
  const { watch, setValue, getValues } = useFormContext();
  const containerRef = useRef(null);

  // Support legacy prop names - memoized
  const effectiveValueKey = useMemo(
    () => valueKey || itemKey || 'id',
    [valueKey, itemKey],
  );
  const effectiveLabelKey = useMemo(
    () => labelKey || itemLabel || 'name',
    [labelKey, itemLabel],
  );
  const effectiveDescriptionKey = useMemo(
    () => descriptionKey || itemDescription,
    [descriptionKey, itemDescription],
  );

  // Merge refs
  const handleRef = useMergeRefs(containerRef, forwardedRef);

  // Get current selected values from form
  const watchedValues = watch(name);

  // Convert selected values to Set for O(1) lookup instead of O(n) Array.includes
  // Note: selectedValues logic is inside useMemo to avoid creating new array references
  const selectedSet = useMemo(
    () => new Set(watchedValues || []),
    [watchedValues],
  );

  // Memoized getters
  const getItemValue = useCallback(
    item => {
      if (typeof effectiveValueKey === 'function') {
        return effectiveValueKey(item);
      }
      return item[effectiveValueKey];
    },
    [effectiveValueKey],
  );

  const getItemLabel = useCallback(
    item => {
      if (typeof effectiveLabelKey === 'function') {
        return effectiveLabelKey(item);
      }
      return item[effectiveLabelKey];
    },
    [effectiveLabelKey],
  );

  const getItemDescription = useCallback(
    item => {
      if (!effectiveDescriptionKey) return undefined;
      if (typeof effectiveDescriptionKey === 'function') {
        return effectiveDescriptionKey(item);
      }
      return item[effectiveDescriptionKey];
    },
    [effectiveDescriptionKey],
  );

  // Handle checkbox change - stable reference
  const handleChange = useCallback(
    e => {
      const { value, checked } = e.target;
      const currentValues = getValues(name) || [];
      if (checked) {
        setValue(name, [...currentValues, value], { shouldValidate: true });
      } else {
        setValue(
          name,
          currentValues.filter(v => v !== value),
          { shouldValidate: true },
        );
      }
    },
    [getValues, setValue, name],
  );

  // Handle load more callback for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (onLoadMore && !loadingMore && hasMore) {
      onLoadMore();
    }
  }, [onLoadMore, loadingMore, hasMore]);

  // Setup infinite scroll
  useInfiniteScroll({
    containerRef,
    onLoadMore: handleLoadMore,
    hasMore,
    loading: loadingMore,
    threshold: 50,
  });

  // Group items if groupBy is specified - memoized
  const groupedItems = useMemo(() => {
    if (!groupBy) return null;

    const grouped = {};
    items.forEach(item => {
      const groupKey = item[groupBy] || 'Other';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(item);
    });
    return grouped;
  }, [items, groupBy]);

  // Handle group "Select All" toggle
  const handleGroupSelectAll = useCallback(
    (groupKey, selectAll) => {
      if (!groupedItems || !groupedItems[groupKey]) return;

      const groupItemValues = groupedItems[groupKey].map(item =>
        getItemValue(item),
      );
      const currentValues = getValues(name) || [];

      if (selectAll) {
        // Add all group items that aren't already selected
        const newValues = [...currentValues];
        groupItemValues.forEach(value => {
          if (!selectedSet.has(value)) {
            newValues.push(value);
          }
        });
        setValue(name, newValues, { shouldValidate: true });
      } else {
        // Remove all group items from selection
        const groupValueSet = new Set(groupItemValues);
        setValue(
          name,
          currentValues.filter(v => !groupValueSet.has(v)),
          { shouldValidate: true },
        );
      }
    },
    [groupedItems, getItemValue, getValues, selectedSet, setValue, name],
  );

  // Memoized group label formatter
  const formatGroupLabel = useCallback(
    key => {
      if (groupLabelFormatter) {
        return groupLabelFormatter(key);
      }
      // Default: capitalize first letter
      return key.charAt(0).toUpperCase() + key.slice(1);
    },
    [groupLabelFormatter],
  );

  // Internal search state for uncontrolled mode
  const [internalSearchValue, setInternalSearchValue] = useState('');
  const effectiveSearchValue =
    searchValue != null ? searchValue : internalSearchValue;

  const handleSearchChange = useCallback(
    e => {
      const { value } = e.target;
      // Always update internal state so the input reflects user typing
      setInternalSearchValue(value);
      // Also notify parent if onSearch is provided
      if (onSearch) {
        onSearch(value);
      }
    },
    [onSearch],
  );

  const handleClearSearch = useCallback(() => {
    setInternalSearchValue('');
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch]);

  // Render checkbox items - now using memoized CheckboxItem component
  const renderCheckboxItem = useCallback(
    item => {
      const value = getItemValue(item);
      const label = getItemLabel(item);
      const description = getItemDescription(item);
      const isChecked = selectedSet.has(value);

      return (
        <CheckboxItem
          key={value}
          value={value}
          label={label}
          description={description}
          isChecked={isChecked}
          name={name}
          disabled={disabled}
          onChange={handleChange}
        />
      );
    },
    [
      getItemValue,
      getItemLabel,
      getItemDescription,
      selectedSet,
      name,
      disabled,
      handleChange,
    ],
  );

  // Dynamic sizing styles preserved as object, styling rules migrated to CSS module
  const dynamicSizing = useMemo(
    () => ({
      maxHeight,
      minHeight,
    }),
    [maxHeight, minHeight],
  );

  return (
    <Flex direction='column' gap='2' className={className}>
      {(searchable || onSearch) && (
        <TextField.Root
          type='text'
          size={size}
          placeholder={displaySearchPlaceholder}
          value={effectiveSearchValue}
          onChange={handleSearchChange}
          color={error ? 'red' : undefined}
          disabled={disabled}
          aria-label={displaySearchPlaceholder}
        >
          <TextField.Slot side='left'>
            <Icon name='search' size={16} />
          </TextField.Slot>
          {effectiveSearchValue && (
            <TextField.Slot side='right'>
              <IconButton
                variant='ghost'
                color='gray'
                size='1'
                onClick={handleClearSearch}
                title={t(
                  'shared:components.checkboxList.clearSearch',
                  'Clear search',
                )}
                disabled={disabled}
              >
                ✕
              </IconButton>
            </TextField.Slot>
          )}
        </TextField.Root>
      )}

      {loading ? (
        <Flex
          align='center'
          justify='center'
          className={clsx(
            s.listContainer,
            error && s.listContainerError,
            groupBy ? s.listContainerNoPadding : s.listContainerPadding,
          )}
          style={dynamicSizing}
        >
          <Text size='2' color='gray' className={s.centerItalic}>
            {displayLoadingMessage}
          </Text>
        </Flex>
      ) : (
        <div
          ref={handleRef}
          id={id}
          className={clsx(
            s.listContainer,
            error && s.listContainerError,
            groupBy ? s.listContainerNoPadding : s.listContainerPadding,
          )}
          // eslint-disable-next-line react/forbid-dom-props
          style={dynamicSizing}
          role='group'
          aria-labelledby={`${id}-label`}
        >
          {items.length > 0 ? (
            <>
              {groupBy && groupedItems
                ? // Grouped rendering
                  Object.entries(groupedItems).map(
                    ([groupKey, groupItems], index) => {
                      // Calculate selected count for this group
                      const groupSelectedCount = groupItems.filter(item =>
                        selectedSet.has(getItemValue(item)),
                      ).length;

                      return (
                        <div
                          key={groupKey}
                          className={
                            index === Object.entries(groupedItems).length - 1
                              ? ''
                              : s.groupItemsFlexBorder
                          }
                        >
                          <GroupHeader
                            groupKey={groupKey}
                            label={formatGroupLabel(groupKey)}
                            selectedCount={groupSelectedCount}
                            totalCount={groupItems.length}
                            disabled={disabled}
                            onToggle={handleGroupSelectAll}
                          />
                          <Flex direction='column' className={s.groupItemsFlex}>
                            {groupItems.map(renderCheckboxItem)}
                          </Flex>
                        </div>
                      );
                    },
                  )
                : // Flat rendering
                  items.map(renderCheckboxItem)}
              {loadingMore && (
                <Box p='3' className={s.centerItalic}>
                  <Text size='2' color='gray' className={s.centerItalic}>
                    {t(
                      'shared:components.checkboxList.loadingMore',
                      'Loading more...',
                    )}
                  </Text>
                </Box>
              )}
            </>
          ) : (
            <Box p='4' className={s.centerItalic}>
              <Text size='2' color='gray' className={s.centerItalic}>
                {displayEmptyMessage}
              </Text>
            </Box>
          )}
        </div>
      )}
    </Flex>
  );
});

FormCheckboxList.propTypes = {
  /** Array of items to display */
  items: PropTypes.array,
  /** Initial loading state */
  loading: PropTypes.bool,
  /** Loading more items indicator */
  loadingMore: PropTypes.bool,
  /** Whether there are more items to load */
  hasMore: PropTypes.bool,
  /** Callback when scrolling to bottom */
  onLoadMore: PropTypes.func,
  /** Enable search input */
  searchable: PropTypes.bool,
  /** Controlled search input value */
  searchValue: PropTypes.string,
  /** Callback when search changes */
  onSearch: PropTypes.func,
  /** Search input placeholder */
  searchPlaceholder: PropTypes.string,
  /** Property to use as checkbox value (or function) */
  valueKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Property to display as label (or function) */
  labelKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Property to display as description (or function) */
  descriptionKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Legacy: Property to use as checkbox value */
  itemKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Legacy: Property to display as label */
  itemLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Legacy: Property to display as description */
  itemDescription: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Property to group items by */
  groupBy: PropTypes.string,
  /** Function to format group labels */
  groupLabelFormatter: PropTypes.func,
  /** Message when no items found */
  emptyMessage: PropTypes.string,
  /** Message while loading */
  loadingMessage: PropTypes.string,
  /** Max height before scrolling */
  maxHeight: PropTypes.number,
  /** Min height */
  minHeight: PropTypes.number,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
};

export default FormCheckboxList;
