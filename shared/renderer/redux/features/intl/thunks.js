import { createPath } from 'history';

import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from '@shared/i18n';

import {
  setLocaleStart,
  setLocaleSuccess,
  setLocaleError,
  setLocaleFallback,
  updateAvailableLocales,
} from './slice';

// =============================================================================
// THUNKS
// =============================================================================

/**
 * Persist locale to cookie via express-request-language URL endpoint
 * This calls the server endpoint which sets the httpOnly cookie properly
 * @param {Object} params - Parameters object
 * @param {string} params.locale - Locale code
 * @param {Function} params.fetch - Fetch function
 * @param {Object} params.history - History object
 * @returns {Promise<Object>}
 */
async function persistLocaleCookie({ locale, fetch, history }) {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return { success: true, skipped: true };
  }

  try {
    // Call express-request-language URL endpoint to set cookie server-side
    // The URL pattern is: /${LOCALE_COOKIE_NAME}/{language}
    await fetch(`/${LOCALE_COOKIE_NAME}/${locale}`);

    // Re-navigate to current route to update context.i18n.t translations
    // This triggers route action re-execution with new language
    // Pass preserveScroll flag to prevent router from resetting scroll position
    history.replace(createPath(history.location), { preserveScroll: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

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
  return async (dispatch, getState, { i18n, fetch, history }) => {
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

      // Persist locale (browser only) - fire and forget
      // Don't await to avoid blocking the UI
      persistLocaleCookie({ locale, fetch, history });

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
 * @param {string} operation - 'set' | 'add' | 'remove' (default: 'set')
 * @returns {Function} Redux thunk action
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
