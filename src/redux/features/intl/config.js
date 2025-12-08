/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './translations/en-US.json';
import viVN from './translations/vi-VN.json';

// =============================================================================
// LOCALE CONFIGURATION
// =============================================================================

// Default locale
export const DEFAULT_LOCALE = 'en-US';

// Cookie max-age in seconds (for cookie max-age attribute)
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

// Cookie and query parameter name
export const LOCALE_COOKIE_NAME = 'lang';

// Internal locale configurations with translations
const LOCALE_CONFIGS = Object.freeze({
  'en-US': { name: 'English (US)', translation: enUS },
  'vi-VN': { name: 'Tiếng Việt', translation: viVN },
});

// Available locales
export const AVAILABLE_LOCALES = Object.freeze(
  Object.fromEntries(
    Object.entries(LOCALE_CONFIGS).map(([key, config]) => [key, config.name]),
  ),
);

// Available translations
export const LOCALE_TRANSLATIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(LOCALE_CONFIGS).map(([k, v]) => [
      k,
      { translation: v.translation },
    ]),
  ),
);

// =============================================================================
// I18NEXT CONFIGURATION
// =============================================================================

const i18nConfig = {
  resources: LOCALE_TRANSLATIONS,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'translation',
  ns: ['translation'],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // Required for SSR
  },
  debug:
    typeof process !== 'undefined' && process.env.RSK_I18N_DEBUG === 'true',
};

/**
 * Create and initialize i18n instance immediately
 * Synchronous initialization for simplicity
 */
const i18nInstance = i18n.createInstance();
i18nInstance.use(initReactI18next).init(i18nConfig);

/**
 * Get i18n instance
 * @returns {Object} Initialized i18n instance
 */
export function getI18nInstance() {
  return i18nInstance;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default i18nInstance;
