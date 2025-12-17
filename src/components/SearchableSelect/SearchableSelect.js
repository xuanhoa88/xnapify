import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import s from './SearchableSelect.css';

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()),
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

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
        // Focus search input slightly after open
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  };

  const handleSelect = optionValue => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div
      className={clsx(s.container, className, { [s.disabled]: disabled })}
      ref={containerRef}
    >
      <div
        className={s.control}
        onClick={handleToggle}
        role='button'
        tabIndex={0}
      >
        <span className={clsx(s.value, { [s.placeholder]: !selectedOption })}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={s.arrow}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className={s.menu}>
          <div className={s.searchContainer}>
            <input
              ref={inputRef}
              type='text'
              className={s.searchInput}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder='Search...'
              onClick={e => e.stopPropagation()}
            />
          </div>
          <ul className={s.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <li
                  key={option.value}
                  className={clsx(s.option, {
                    [s.selected]: option.value === value,
                  })}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li className={s.noOptions}>No options found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

SearchableSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

SearchableSelect.defaultProps = {
  placeholder: 'Select...',
  disabled: false,
};

export default SearchableSelect;
