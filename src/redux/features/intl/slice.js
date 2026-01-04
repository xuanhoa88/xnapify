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
 */
const intlSlice = createSlice({
  name: 'intl',
  initialState: {
    locale: DEFAULT_LOCALE, // Current locale
    localeLoading: null, // Locale currently being loaded (null = no loading in progress)
    localeFallback: null, // Fallback info when requested locale is not available
    availableLocales: AVAILABLE_LOCALES, // List of available locales
  },
  reducers: {
    setLocaleStart: (state, action) => {
      state.localeLoading = action.payload.locale;
    },

    setLocaleSuccess: (state, action) => {
      state.locale = action.payload.locale;
      state.localeLoading = null;
    },

    setLocaleError: state => {
      state.localeLoading = null;
    },

    setLocaleFallback: (state, action) => {
      state.localeFallback = {
        requestedLocale: action.payload.requestedLocale,
        fallbackLocale: action.payload.fallbackLocale,
        timestamp: Date.now(),
      };
    },

    /**
     * Replace all available locales (internal - use thunk for validation)
     * @param {Object} action.payload - Object of { localeCode: localeName }
     */
    updateAvailableLocales: (state, action) => {
      state.availableLocales = action.payload;
    },
  },
});

export const {
  setLocaleStart,
  setLocaleSuccess,
  setLocaleError,
  setLocaleFallback,
  updateAvailableLocales,
} = intlSlice.actions;

export default intlSlice.reducer;
