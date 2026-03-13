/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSelector } from '@reduxjs/toolkit';

import { normalizeState } from './utils';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const selectIntlRaw = state => state && state.intl;

/**
 * Safely get intl state with normalization
 *
 * @param {Object} state - Redux state
 * @returns {Object} Normalized intl state
 */
const getIntlState = createSelector([selectIntlRaw], intl =>
  normalizeState(intl),
);

// =============================================================================
// LOCALE SELECTORS
// =============================================================================

/**
 * Get current locale
 *
 * @param {Object} state - Redux state
 * @returns {string} Current locale code
 */
export const getLocale = state => {
  const intl = getIntlState(state);
  return intl.locale;
};

/**
 * Check if a locale change is in progress
 *
 * @param {Object} state - Redux state
 * @returns {boolean} Whether locale is currently loading
 */
export const isLocaleLoading = state => {
  const intl = getIntlState(state);
  return intl.localeLoading !== null;
};

/**
 * Get the locale currently being loaded (if any)
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Locale code being loaded or null
 */
export const getLoadingLocale = state => {
  const intl = getIntlState(state);
  return intl.localeLoading;
};

// =============================================================================
// FALLBACK SELECTORS
// =============================================================================

/**
 * Get locale fallback info if any
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Fallback info object or null
 */
export const getLocaleFallback = state => {
  const intl = getIntlState(state);
  return intl.localeFallback;
};

/**
 * Check if there was a locale fallback
 *
 * @param {Object} state - Redux state
 * @returns {boolean} Whether a fallback occurred
 */
export const hasLocaleFallback = state => {
  return getLocaleFallback(state) !== null;
};

// =============================================================================
// AVAILABLE LOCALES SELECTORS
// =============================================================================

/**
 * Get available locales map
 *
 * @param {Object} state - Redux state
 * @returns {Object} Available locales object { code: name }
 */
export const getAvailableLocales = state => {
  const intl = getIntlState(state);
  return intl.availableLocales;
};

/**
 * Get list of available locale codes
 *
 * @param {Object} state - Redux state
 * @returns {string[]} Array of available locale codes
 */
export const getAvailableLocaleCodes = createSelector(
  [getAvailableLocales],
  locales => Object.keys(locales),
);

/**
 * Check if a locale is available
 *
 * @param {Object} state - Redux state
 * @param {string} localeCode - Locale code to check
 * @returns {boolean} Whether the locale is available
 */
export const isLocaleAvailable = (state, localeCode) => {
  const locales = getAvailableLocales(state);
  return Object.prototype.hasOwnProperty.call(locales, localeCode);
};

/**
 * Get display name for a locale
 *
 * @param {Object} state - Redux state
 * @param {string} localeCode - Locale code
 * @returns {string|null} Locale display name or null if not found
 */
export const getLocaleDisplayName = (state, localeCode) => {
  const locales = getAvailableLocales(state);
  return locales[localeCode] || null;
};

/**
 * Get display name for current locale
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Current locale display name
 */
export const getCurrentLocaleDisplayName = state => {
  const locale = getLocale(state);
  return getLocaleDisplayName(state, locale);
};
