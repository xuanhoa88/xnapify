/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get current locale
 * @param {Object} state - Redux state
 * @returns {string|null} Current locale code
 */
export const getLocale = state => (state.intl && state.intl.locale) || null;

/**
 * Get locale currently being loaded
 * @param {Object} state - Redux state
 * @returns {string|null} Locale being loaded, or null if no loading in progress
 */
export const getLocaleLoading = state =>
  (state.intl && state.intl.localeLoading) || null;

/**
 * Check if a locale is currently being loaded
 * @param {Object} state - Redux state
 * @returns {boolean} True if locale is loading
 */
export const isLocaleLoading = state => !!getLocaleLoading(state);

/**
 * Get loaded messages for a specific locale
 * @param {Object} state - Redux state
 * @param {string} locale - Locale code
 * @returns {Object|null} Messages object or null if not loaded
 */
export const getLocaleMessages = (state, locale) =>
  (state.intl && state.intl.messages && state.intl.messages[locale]) || null;

/**
 * Get locale fallback info if any
 * @param {Object} state - Redux state
 * @returns {Object|null} Fallback info object or null
 */
export const getLocaleFallback = state =>
  (state.intl && state.intl.localeFallback) || null;
