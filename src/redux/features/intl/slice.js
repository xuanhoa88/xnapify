/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from '../../../shared/i18n';

/**
 * Intl Slice
 *
 * Manages internationalization state including current locale.
 * Note: Translation messages are managed by i18next, not Redux.
 *
 * State shape:
 * {
 *   locale: string,                    // Current locale code
 *   localeLoading: string | null,      // Locale being loaded (null = no loading)
 *   localeFallback: Object | null,     // Fallback info when locale unavailable
 *   availableLocales: Object           // Map of { localeCode: localeName }
 * }
 */

/**
 * Create a fresh state object with default values.
 * This ensures we never return a reference to a frozen initialState.
 */
const createFreshState = () => ({
  locale: DEFAULT_LOCALE,
  localeLoading: null,
  localeFallback: null,
  availableLocales: { ...AVAILABLE_LOCALES },
});

// Initial state with fresh values
const initialState = createFreshState();

/**
 * Normalize state to ensure it has the expected shape.
 * This handles migration from old state format or SSR hydration.
 * Always clones to ensure mutability (avoids SSR frozen state issues).
 * Exported for reuse in selectors.
 *
 * @param {Object|null|undefined} state - Intl state to normalize
 * @returns {Object} Normalized state with expected shape
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return createFreshState();
  }

  // Clone and merge with defaults to ensure all properties exist
  return {
    ...createFreshState(),
    ...state,
    // Deep clone availableLocales to ensure mutability
    availableLocales: {
      ...AVAILABLE_LOCALES,
      ...(state.availableLocales || {}),
    },
  };
};

const intlSlice = createSlice({
  name: 'intl',
  initialState,
  reducers: {
    /**
     * Start locale change (sets loading state)
     */
    setLocaleStart: (state, action) => {
      state.localeLoading = action.payload.locale;
    },

    /**
     * Complete locale change (clears loading state)
     */
    setLocaleSuccess: (state, action) => {
      state.locale = action.payload.locale;
      state.localeLoading = null;
    },

    /**
     * Handle locale change error (clears loading state)
     */
    setLocaleError: state => {
      state.localeLoading = null;
    },

    /**
     * Record locale fallback info
     */
    setLocaleFallback: (state, action) => {
      state.localeFallback = {
        requestedLocale: action.payload.requestedLocale,
        fallbackLocale: action.payload.fallbackLocale,
        timestamp: Date.now(),
      };
    },

    /**
     * Clear locale fallback info
     */
    clearLocaleFallback: state => {
      state.localeFallback = null;
    },

    /**
     * Replace all available locales (internal - use thunk for validation)
     * @param {Object} action.payload - Object of { localeCode: localeName }
     */
    updateAvailableLocales: (state, action) => {
      state.availableLocales = action.payload;
    },

    /**
     * Reset to initial state (used for SSR hydration edge cases)
     */
    resetIntlState: () => initialState,
  },
});

export const {
  setLocaleStart,
  setLocaleSuccess,
  setLocaleError,
  setLocaleFallback,
  clearLocaleFallback,
  updateAvailableLocales,
  resetIntlState,
} = intlSlice.actions;

export default intlSlice.reducer;
