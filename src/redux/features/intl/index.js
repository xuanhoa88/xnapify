/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Public API - Selectors
export {
  // Locale selectors
  getLocale,
  isLocaleLoading,
  getLoadingLocale,
  // Fallback selectors
  getLocaleFallback,
  hasLocaleFallback,
  // Available locales selectors
  getAvailableLocales,
  getAvailableLocaleCodes,
  isLocaleAvailable,
  getLocaleDisplayName,
  getCurrentLocaleDisplayName,
} from './selector';

// Public API - Async Thunks
export { setLocale, setAvailableLocales } from './thunks';

// Public API - Actions (from slice)
export {
  setLocaleStart,
  setLocaleSuccess,
  setLocaleError,
  setLocaleFallback,
  clearLocaleFallback,
  updateAvailableLocales,
  resetIntlState,
} from './slice';

// Public API - Reducer
export { default } from './slice';
