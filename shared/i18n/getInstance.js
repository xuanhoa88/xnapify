/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE } from './constants';

// Create i18n instance
const defaultI18nInstance = i18n.createInstance();

/**
 * Detect the locale to initialize i18n with.
 *
 * On the client, Html.js injects `window.__XNAPIFY_LOCALE__` as a tiny
 * dedicated script before the Redux state blob. Reading this string here —
 * before the i18n singleton is created — ensures React hydration happens in
 * the same language the server used, preventing "Text content did not match"
 * hydration warnings.
 *
 * On the server `window` is undefined so we fall back to DEFAULT_LOCALE;
 * the server then calls i18n.changeLanguage() via setLocale() in Redux.
 *
 * Deliberately reads only `__XNAPIFY_LOCALE__` — not `__PRELOADED_STATE__` —
 * so that shared/i18n stays decoupled from Redux's state shape.
 */
function detectInitialLocale() {
  // eslint-disable-next-line no-underscore-dangle
  return globalThis.__XNAPIFY_LOCALE__ || DEFAULT_LOCALE;
}

const initialLocale = detectInitialLocale();

// Create and initialize i18n instance immediately.
// `lng` is set to the server-preloaded locale so the instance is born in the
// correct language — no async changeLanguage() needed before hydration.
defaultI18nInstance.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'translation',
  ns: ['translation'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // Required for SSR
    bindI18n: 'languageChanged loaded', // Re-render on language change
    bindI18nStore: 'added removed', // Re-render on store changes
  },
  debug: process.env.XNAPIFY_I18N_DEBUG === 'true',
});

/**
 * Resolve and validate i18n instance
 */
export function resolveInstance(i18nInstance) {
  const i18n = i18nInstance || defaultI18nInstance;

  if (!i18n || !i18n.options) {
    if (__DEV__) {
      console.warn('[i18n] Instance is not ready');
    }
    return null;
  }

  return i18n;
}

/**
 * Return all locale keys that have actually been loaded into the store.
 * Prefer `i18n.store.data` over `i18n.options.resources` because dynamic
 * bundles added via `addResourceBundle` are reflected in the store but not
 * always back-written to `options.resources`.
 *
 * @param {import('i18next').i18n} i18n
 * @returns {string[]}
 */
export function getStoreLocales(i18nInstance) {
  const i18n = resolveInstance(i18nInstance);
  return i18n && i18n.store ? Object.keys(i18n.store.data) : [];
}

export default defaultI18nInstance;
