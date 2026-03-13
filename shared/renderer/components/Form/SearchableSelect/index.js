/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef, useCallback } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useFormContext, useController } from 'react-hook-form';

import SearchableSelect from '../../SearchableSelect/SearchableSelect';
import { useFormField, useMergeRefs } from '../FormContext';

import s from './FormSearchableSelect.css';

/**
 * FormSearchableSelect - Searchable select component for use inside Form.Field
 *
 * Features:
 * - Integrates with react-hook-form via Controller
 * - Inherits all SearchableSelect features: search, infinite scroll, multi-select
 * - Automatic error styling from form context
 *
 * Usage:
 *   <Form.Field name="role" label="Role">
 *     <Form.SearchableSelect
 *       options={[{ value: 'admin', label: 'Admin' }]}
 *       placeholder="Select a role"
 *     />
 *   </Form.Field>
 *
 *   // With async search
 *   <Form.Field name="users" label="Users">
 *     <Form.SearchableSelect
 *       options={users}
 *       onSearch={handleSearch}
 *       onLoadMore={handleLoadMore}
 *       loading={isLoading}
 *       hasMore={hasMore}
 *       multiple
 *       clearable
 *     />
 *   </Form.Field>
 */
const FormSearchableSelect = forwardRef(function FormSearchableSelect$(
  {
    options = [],
    placeholder,
    className,
    disabled,
    // SearchableSelect props
    onSearch,
    onLoadMore,
    searchPlaceholder,
    debounceMs,
    loading,
    loadingMore,
    hasMore,
    multiple,
    showSearch,
    clearable,
    ...props
  },
  forwardedRef,
) {
  const { id, name, error } = useFormField();
  const { control } = useFormContext();

  // Use Controller for controlled component integration
  const {
    field: { value, onChange, ref: fieldRef },
  } = useController({
    name,
    control,
  });

  // Merge refs - react-hook-form ref and forwarded ref
  const handleRef = useMergeRefs(fieldRef, forwardedRef);

  // Handle change with react-hook-form
  const handleChange = useCallback(
    newValue => {
      onChange(newValue);
    },
    [onChange],
  );

  return (
    <div className={s.wrapper} ref={handleRef}>
      <SearchableSelect
        id={id}
        options={options}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={clsx({ [s.error]: error }, className)}
        // Pass through SearchableSelect props
        onSearch={onSearch}
        onLoadMore={onLoadMore}
        searchPlaceholder={searchPlaceholder}
        debounceMs={debounceMs}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        multiple={multiple}
        showSearch={showSearch}
        clearable={clearable}
        {...props}
      />
    </div>
  );
});

FormSearchableSelect.propTypes = {
  /** Options array with { value, label } objects */
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Callback for async search (receives search term) */
  onSearch: PropTypes.func,
  /** Callback for infinite scroll loading more */
  onLoadMore: PropTypes.func,
  /** Placeholder for search input */
  searchPlaceholder: PropTypes.string,
  /** Debounce delay for search in ms */
  debounceMs: PropTypes.number,
  /** Loading state for initial load */
  loading: PropTypes.bool,
  /** Loading state for loading more (infinite scroll) */
  loadingMore: PropTypes.bool,
  /** Whether there are more items to load */
  hasMore: PropTypes.bool,
  /** Enable multi-select mode */
  multiple: PropTypes.bool,
  /** Show search input in dropdown */
  showSearch: PropTypes.bool,
  /** Show clear button when has value */
  clearable: PropTypes.bool,
};

export default FormSearchableSelect;
