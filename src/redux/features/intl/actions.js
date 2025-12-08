/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  SET_LOCALE_ERROR,
  SET_LOCALE_FALLBACK,
  SET_LOCALE_START,
  SET_LOCALE_SUCCESS,
  SET_AVAILABLE_LOCALES,
} from './constants';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
} from './config';

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if running in browser environment
 * @returns {boolean}
 */
function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * Set locale cookie in browser
 * @param {string} locale - Locale code
 */
function setLocaleCookie(locale) {
  if (!isBrowser()) return;

  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=${LOCALE_COOKIE_MAX_AGE}`;
}

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Set application locale
 *
 * Changes the application language and persists the choice:
 * 1. Validates locale against availableLocales runtime variable from Redux store
 * 2. Falls back to first available locale if invalid
 * 3. Dispatches SET_LOCALE_START action
 * 4. Changes i18next language
 * 5. Dispatches SET_LOCALE_SUCCESS action
 * 6. Saves locale to cookie (browser only)
 * 7. Updates URL with locale parameter (browser only)
 *
 * @param {string} locale - Locale code (e.g., 'en-US', 'vi-VN')
 * @returns {Function} Redux thunk action
 */
export function setLocale(locale) {
  return async (dispatch, getState, { i18n }) => {
    const { intl } = getState();
    try {
      // Check if locale is available
      if (!intl.availableLocales || typeof intl.availableLocales !== 'object') {
        console.error('Invalid availableLocales:', intl.availableLocales);
        return null;
      }

      // Get available locales from runtime variables
      const availableLocales = Object.keys(intl.availableLocales);

      // Validate locale parameter
      if (typeof locale !== 'string' || locale.trim().length === 0) {
        console.error('Invalid locale (not a string):', locale);
        return null;
      }

      // Check if locale is available
      if (!availableLocales.includes(locale)) {
        const requestedLocale = locale;
        const fallbackLocale = availableLocales[0] || DEFAULT_LOCALE;

        console.warn(
          `Locale "${requestedLocale}" is not available. Available locales:`,
          availableLocales,
        );
        console.info(`Falling back to locale: ${fallbackLocale}`);

        // Dispatch fallback action for error handling in components
        dispatch({
          type: SET_LOCALE_FALLBACK,
          payload: { requestedLocale, fallbackLocale },
        });

        // Use fallback locale
        // eslint-disable-next-line no-param-reassign
        locale = fallbackLocale;
      }

      // Start locale change
      dispatch({
        type: SET_LOCALE_START,
        payload: { locale },
      });

      // Change i18next language using helper
      await i18n.changeLanguage(locale);

      // Get the loaded messages from i18next resource store
      const messages = i18n.getResourceBundle(locale, 'translation');

      // Success - update Redux state with locale and messages
      dispatch({
        type: SET_LOCALE_SUCCESS,
        payload: { locale, messages },
      });

      // Persist locale (browser only)
      setLocaleCookie(locale);

      return locale;
    } catch (error) {
      // Error - update Redux state
      console.error('Failed to change locale:', error);

      dispatch({
        type: SET_LOCALE_ERROR,
        payload: {
          locale,
          error: error.message || 'Unknown error',
        },
      });

      return null;
    }
  };
}

/**
 * Set available locales
 * @param {Object} availableLocales - Available locales
 */
export function setAvailableLocales(availableLocales) {
  return {
    type: SET_AVAILABLE_LOCALES,
    payload: availableLocales,
  };
}
