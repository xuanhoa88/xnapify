/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import {
  getLocale,
  setLocale,
  getAvailableLocales,
} from '../../../../../../../shared/renderer/redux';
import Icon from '../../../../../../../components/Icon';
import Button from '../../../../../../../components/Button';
import s from './LanguageSwitcher.css';

/**
 * LanguageSwitcher Component
 * Dropdown-based language switcher for the main header
 */
function LanguageSwitcher() {
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);
  const availableLocales = useSelector(getAvailableLocales);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Get current language name
  const currentLanguageName = useMemo(() => {
    return availableLocales[currentLocale] || currentLocale;
  }, [availableLocales, currentLocale]);

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
      <Button
        variant='unstyled'
        className={s.trigger}
        onClick={handleToggle}
        title='Language switcher'
      >
        <Icon name='globe' size={18} className={s.globeIcon} />
        <span className={s.langName}>{currentLanguageName}</span>
        <Icon
          name='chevronDown'
          size={12}
          className={clsx(s.chevron, { [s.chevronOpen]: isOpen })}
        />
      </Button>

      {isOpen && (
        <div className={s.dropdown} role='menu'>
          {localeEntries.map(([code, name]) => (
            <Button
              key={code}
              variant='unstyled'
              onClick={e => handleLocaleChange(code, e)}
              className={clsx(s.option, {
                [s.optionActive]: code === currentLocale,
              })}
            >
              <span className={s.optionName}>{name}</span>
              {code === currentLocale && (
                <Icon name='check' size={14} className={s.checkmark} />
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
