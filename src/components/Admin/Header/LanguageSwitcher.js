/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import { getLocale, setLocale, getAvailableLocales } from '../../../redux';
import Icon from '../../Icon';
import s from './LanguageSwitcher.css';

/**
 * LanguageSwitcher Component
 * Dropdown-based language switcher for scalable multi-language support
 */
function AdminLanguageSwitcher() {
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);
  const availableLocales = useSelector(getAvailableLocales);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Get current language name
  const currentLanguageName = useMemo(() => {
    return availableLocales[currentLocale] || currentLocale;
  }, [availableLocales, currentLocale]);

  // Get language code (e.g., "EN" from "en-US")
  const languageCode = useMemo(() => {
    return currentLocale.split('-')[0].toUpperCase();
  }, [currentLocale]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleLocaleChange = useCallback(
    (locale, e) => {
      e.preventDefault();
      dispatch(setLocale(locale));
      setIsOpen(false);
    },
    [dispatch],
  );

  // Memoize available locales
  const localeEntries = useMemo(
    () => Object.entries(availableLocales),
    [availableLocales],
  );

  // If no locales or only one locale, return null
  if (localeEntries.length <= 1) {
    return null;
  }

  return (
    <div className={s.wrapper} ref={dropdownRef}>
      <button
        className={s.trigger}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup='true'
        type='button'
      >
        <span className={s.globeIcon}>
          <svg
            className={s.globeIcon}
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
            <path
              d='M2 12H22'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
            <path
              d='M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </span>
        <span className={s.code}>{currentLanguageName || languageCode}</span>
        <Icon
          name='chevronDown'
          size={12}
          className={clsx(s.chevron, { [s.chevronOpen]: isOpen })}
        />
      </button>

      {isOpen && (
        <div className={s.dropdown}>
          {localeEntries.map(([code, name]) => (
            <button
              key={code}
              onClick={e => handleLocaleChange(code, e)}
              className={clsx(s.option, {
                [s.optionActive]: code === currentLocale,
              })}
              type='button'
            >
              <span className={s.optionName}>{name}</span>
              {code === currentLocale && <span className={s.checkmark}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminLanguageSwitcher;
