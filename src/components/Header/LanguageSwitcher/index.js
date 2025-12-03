/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import { LOCALE_COOKIE_NAME, setLocale } from '../../../redux';
import s from './LanguageSwitcher.css';

/**
 * LanguageSwitcher Component
 * Allows users to switch between available locales
 */
function LanguageSwitcher() {
  // Redux hooks
  const dispatch = useDispatch();
  const currentLocale = useSelector(state => state.intl.locale);

  // Get available locales from runtime variables
  const availableLocales = useSelector(
    state => state.runtime.availableLocales || {},
  );

  /**
   * Handle locale change
   * @param {string} locale - The locale to switch to
   * @param {Event} e - Click event
   */
  const handleLocaleChange = useCallback(
    (locale, e) => {
      e.preventDefault();
      dispatch(setLocale(locale));
    },
    [dispatch],
  );

  /**
   * Check if locale is currently selected
   * @param {string} locale - Locale to check
   * @returns {boolean}
   */
  const isSelected = useCallback(
    locale => locale === currentLocale,
    [currentLocale],
  );

  // Don't render if no locales available (prevents hydration mismatch)
  const localeEntries = Object.entries(availableLocales);
  if (localeEntries.length === 0) {
    return null;
  }

  return (
    <div className={s.root}>
      {localeEntries.map(([code, name]) => (
        <a
          key={code}
          href={`?${LOCALE_COOKIE_NAME}=${code}`}
          onClick={e => handleLocaleChange(code, e)}
          className={clsx(s.link, { [s.active]: isSelected(code) })}
          aria-current={isSelected(code) ? 'true' : undefined}
        >
          {name}
        </a>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
