/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  setLocaleStart,
  setLocaleSuccess,
  setLocaleError,
  setLocaleFallback,
  updateAvailableLocales,
} from './slice';
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
// THUNKS
// =============================================================================

/**
 * Set application locale
 *
 * Changes the application language and persists the choice:
 * 1. Validates locale against availableLocales from Redux store
 * 2. Falls back to first available locale if invalid
 * 3. Dispatches setLocaleStart action
 * 4. Changes i18next language
 * 5. Dispatches setLocaleSuccess action
 * 6. Saves locale to cookie (browser only)
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
        return {
          success: false,
          error: 'Invalid availableLocales configuration',
        };
      }

      // Get available locales from state
      const availableLocales = Object.keys(intl.availableLocales);

      // Validate locale parameter
      if (typeof locale !== 'string' || locale.trim().length === 0) {
        console.error('Invalid locale (not a string):', locale);
        return { success: false, error: 'Invalid locale parameter' };
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
        dispatch(setLocaleFallback({ requestedLocale, fallbackLocale }));

        // Use fallback locale
        // eslint-disable-next-line no-param-reassign
        locale = fallbackLocale;
      }

      // Start locale change
      dispatch(setLocaleStart({ locale }));

      // Change i18next language
      await i18n.changeLanguage(locale);

      // Success - update Redux state with locale
      dispatch(setLocaleSuccess({ locale }));

      // Persist locale (browser only)
      setLocaleCookie(locale);

      return { success: true, data: locale };
    } catch (error) {
      // Error - update Redux state
      console.error('Failed to change locale:', error);

      dispatch(setLocaleError());

      return { success: false, error: error.message };
    }
  };
}

/**
 * Update available locales with support for add, remove, and replace operations
 *
 * Manages the availableLocales map with different operation modes:
 * - 'set': Replace all locales (default)
 * - 'add': Add/update locales (merge with existing)
 * - 'remove': Remove specified locales
 *
 * @param {Object|string[]} locales - Locales to add/set ({ code: name }) or remove ([codes])
 * @param {Object} options - Operation options
 * @param {string} options.operation - 'set' | 'add' | 'remove' (default: 'set')
 * @returns {Function} Redux thunk action
 *
 * @example
 * // Replace all locales
 * dispatch(setAvailableLocales({ 'en-US': 'English', 'fr-FR': 'Français' }));
 *
 * // Add/update locales (merge)
 * dispatch(setAvailableLocales({ 'de-DE': 'Deutsch' }, 'add'));
 *
 * // Remove locales
 * dispatch(setAvailableLocales(['de-DE', 'fr-FR'], 'remove'));
 */
export function setAvailableLocales(locales, operation = 'set') {
  return (dispatch, getState) => {
    try {
      const { intl } = getState();
      const currentLocales = { ...intl.availableLocales };

      // Handle 'remove' operation
      if (operation === 'remove') {
        if (!Array.isArray(locales)) {
          return {
            success: false,
            error: 'Remove operation requires an array of locale codes',
          };
        }

        const removed = [];
        for (const code of locales) {
          if (typeof code !== 'string' || !code.trim()) {
            return { success: false, error: `Invalid locale code: ${code}` };
          }

          // Prevent removing default locale
          if (code === DEFAULT_LOCALE) {
            console.warn(`Cannot remove default locale: ${DEFAULT_LOCALE}`);
            continue;
          }

          // Prevent removing current locale
          if (code === intl.locale) {
            console.warn(`Cannot remove current locale: ${code}`);
            continue;
          }

          if (currentLocales[code]) {
            delete currentLocales[code];
            removed.push(code);
          }
        }

        // Ensure at least one locale remains
        if (Object.keys(currentLocales).length === 0) {
          return { success: false, error: 'Cannot remove all locales' };
        }

        dispatch(updateAvailableLocales(currentLocales));
        return { success: true, data: { operation: 'remove', removed } };
      }

      // Handle 'set' and 'add' operations
      if (!locales || typeof locales !== 'object' || Array.isArray(locales)) {
        return {
          success: false,
          error: 'Invalid locales parameter (expected object)',
        };
      }

      // Validate each locale entry
      for (const [code, name] of Object.entries(locales)) {
        if (typeof code !== 'string' || !code.trim()) {
          return { success: false, error: `Invalid locale code: ${code}` };
        }
        if (typeof name !== 'string' || !name.trim()) {
          return { success: false, error: `Invalid locale name for ${code}` };
        }
      }

      let newLocales;

      if (operation === 'add') {
        // Merge with existing locales
        newLocales = { ...currentLocales, ...locales };
      } else {
        // Replace all locales ('set' operation)
        newLocales = { ...locales };

        // Ensure at least one locale exists
        if (Object.keys(newLocales).length === 0) {
          return { success: false, error: 'At least one locale is required' };
        }

        // Warn if current locale will be removed
        if (!newLocales[intl.locale]) {
          console.warn(
            `Current locale "${intl.locale}" not in new locales. Consider changing locale first.`,
          );
        }
      }

      dispatch(updateAvailableLocales(newLocales));

      return {
        success: true,
        data: {
          operation,
          locales: newLocales,
          added: operation === 'add' ? Object.keys(locales) : undefined,
        },
      };
    } catch (error) {
      console.error('Failed to update available locales:', error);
      return { success: false, error: error.message };
    }
  };
}
