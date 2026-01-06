/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useRef, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormField, useMergeRefs } from '../FormContext';
import { useInfiniteScroll } from '../../InfiniteScroll';
import s from './FormCheckboxList.css';

/**
 * FormCheckboxList - Multi-select checkbox list with search and infinite scroll
 *
 * Usage:
 *   <Form.Field name="roles" label="Roles">
 *     <Form.CheckboxList
 *       items={roles}
 *       loading={rolesLoading}
 *       loadingMore={rolesLoadingMore}
 *       hasMore={rolesHasMore}
 *       onLoadMore={handleLoadMoreRoles}
 *       searchValue={roleSearch}
 *       onSearchChange={setRoleSearch}
 *       searchPlaceholder="Search roles..."
 *       itemKey="name"
 *       itemLabel="name"
 *       itemDescription="description"
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
    searchValue = '',
    onSearchChange,
    searchPlaceholder = 'Search...',
    itemKey = 'id',
    itemLabel = 'name',
    itemDescription = 'description',
    emptyMessage = 'No items found',
    loadingMessage = 'Loading...',
    maxHeight = 320,
    minHeight = 160,
    className,
    disabled,
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { watch, setValue, getValues } = useFormContext();
  const containerRef = useRef(null);

  // Merge refs
  const handleRef = useMergeRefs(containerRef, forwardedRef);

  // Get current selected values
  const selectedValues = watch(name) || [];

  // Handle checkbox change
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

  // Get item value based on itemKey prop
  const getItemValue = item => {
    if (typeof itemKey === 'function') {
      return itemKey(item);
    }
    return item[itemKey];
  };

  // Get item label based on itemLabel prop
  const getItemLabel = item => {
    if (typeof itemLabel === 'function') {
      return itemLabel(item);
    }
    return item[itemLabel];
  };

  // Get item description based on itemDescription prop
  const getItemDescription = item => {
    if (typeof itemDescription === 'function') {
      return itemDescription(item);
    }
    return item[itemDescription];
  };

  return (
    <div className={clsx(s.wrapper, className)}>
      {onSearchChange && (
        <input
          type='text'
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className={s.searchInput}
          disabled={disabled}
          aria-label={searchPlaceholder}
        />
      )}

      {loading ? (
        <div className={s.loading}>{loadingMessage}</div>
      ) : (
        <div
          ref={handleRef}
          id={id}
          className={clsx(s.checkboxGroup, { [s.checkboxGroupError]: error })}
          style={{ maxHeight, minHeight }}
          role='group'
          aria-labelledby={`${id}-label`}
        >
          {items.length > 0 ? (
            <>
              {items.map(item => {
                const value = getItemValue(item);
                const label = getItemLabel(item);
                const description = getItemDescription(item);
                const isChecked = selectedValues.includes(value);

                return (
                  <label key={value} className={s.checkboxItem}>
                    <input
                      type='checkbox'
                      name={name}
                      value={value}
                      checked={isChecked}
                      onChange={handleChange}
                      disabled={disabled}
                    />
                    <span>
                      {label}
                      {description && (
                        <span className={s.itemDescription}>{description}</span>
                      )}
                    </span>
                  </label>
                );
              })}
              {loadingMore && (
                <div className={s.loadingMore}>Loading more...</div>
              )}
            </>
          ) : (
            <div className={s.empty}>{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
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
  /** Controlled search input value */
  searchValue: PropTypes.string,
  /** Callback when search changes */
  onSearchChange: PropTypes.func,
  /** Search input placeholder */
  searchPlaceholder: PropTypes.string,
  /** Property to use as checkbox value (or function) */
  itemKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Property to display as label (or function) */
  itemLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  /** Property to display as description (or function) */
  itemDescription: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
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
