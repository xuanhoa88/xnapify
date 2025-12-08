/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import { getLocale, setLocale, getAvailableLocales } from '../../../redux';
import s from './LanguageSwitcher.css';

/**
 * LanguageSwitcher Component
 * Allows users to switch between available locales
 */
function LanguageSwitcher() {
  // Redux hooks
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);

  // Get available locales from runtime variables
  const availableLocales = useSelector(getAvailableLocales);

  // Handle locale change
  const handleLocaleChange = useCallback(
    (locale, e) => {
      e.preventDefault();
      dispatch(setLocale(locale));
    },
    [dispatch],
  );

  // Check if locale is currently selected
  const isSelected = useCallback(
    locale => locale === currentLocale,
    [currentLocale],
  );

  // Memoize available locales
  const localeEntries = useMemo(
    () => Object.entries(availableLocales),
    [availableLocales],
  );

  // If no locales are available, return null
  if (localeEntries.length === 0) {
    return null;
  }

  return (
    <div className={s.root}>
      {localeEntries.map(([code, name]) => (
        <button
          key={code}
          onClick={e => handleLocaleChange(code, e)}
          className={clsx(s.link, { [s.active]: isSelected(code) })}
          type='button'
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
