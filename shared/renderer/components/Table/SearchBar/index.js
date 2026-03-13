/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useRef, useEffect } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';

import Button from '../../Button';
import Icon from '../../Icon';

import s from './SearchBar.css';

/**
 * Reusable search bar component for admin tables.
 *
 * @param {object} props - Component props
 * @param {string} props.value - Current search value
 * @param {Function} props.onChange - Callback when search value changes
 * @param {string} [props.placeholder='Search...'] - Placeholder text
 * @param {number} [props.debounce=500] - Debounce delay in ms (0 to disable)
 * @param {Function} [props.onSubmit] - Optional callback for Enter key
 * @param {string} [props.className] - Additional CSS class
 */
function SearchBar({
  value,
  onChange,
  onSubmit,
  className,
  children,
  placeholder = 'Search...',
  debounce = 500,
}) {
  const debounceTimer = useRef(null);
  const inputRef = useRef(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    e => {
      const newValue = e.target.value;

      if (debounce > 0) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
          onChange(newValue);
        }, debounce);
      } else {
        onChange(newValue);
      }

      // Update input value immediately for user feedback
      if (inputRef.current) {
        inputRef.current.value = newValue;
      }
    },
    [onChange, debounce],
  );

  const handleClear = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange('');
  }, [onChange]);

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        if (onSubmit) {
          onSubmit((inputRef.current && inputRef.current.value) || '');
        } else {
          onChange((inputRef.current && inputRef.current.value) || '');
        }
      }
    },
    [onChange, onSubmit],
  );

  return (
    <div className={clsx(s.searchWrapper, className)}>
      <div className='search-container'>
        <span className='search-icon'>
          <Icon name='search' size={16} />
        </span>
        <input
          ref={inputRef}
          type='text'
          placeholder={placeholder}
          className='search-input'
          defaultValue={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <Button
            variant='ghost'
            size='small'
            iconOnly
            className='search-clear'
            onClick={handleClear}
            title='Clear search'
          >
            ✕
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

SearchBar.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  debounce: PropTypes.number,
  onSubmit: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default SearchBar;
