/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { initReactI18next } from 'react-i18next';
import i18nInstance from './instance';
import { getTranslations } from './getTranslations';
import { addNamespace } from './addNamespace';

// Export utilities
export { getTranslations, addNamespace };

// =============================================================================
// LOCALE CONFIGURATION
// =============================================================================

// Default locale
export const DEFAULT_LOCALE = 'en-US';

// Cookie max-age in seconds (for cookie max-age attribute)
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

// Cookie and query parameter name
export const LOCALE_COOKIE_NAME = 'lang';

/**
 * Get display name for a locale using native Intl.DisplayNames API
 * @param {string} locale - The locale code (e.g., 'en-US', 'vi-VN')
 * @returns {string} Display name for the locale
 */
function getLocaleDisplayName(locale) {
  try {
    // Extract language code from locale (e.g., 'en' from 'en-US')
    const [language] = locale.split('-');

    // Use Intl.DisplayNames to get the native name of the language
    const displayNames = new Intl.DisplayNames([locale], { type: 'language' });
    const name = displayNames.of(language);

    return name || locale;
  } catch (error) {
    // Fallback to the locale code if Intl.DisplayNames fails
    console.warn(`Failed to get display name for locale ${locale}:`, error);
    return locale;
  }
}

/**
 * Get all locale configurations dynamically using require.context
 * Works for both server and client since webpack bundles both
 * @returns {Object} Frozen object mapping locale codes to { name, translation }
 */
function getDefaultLocales() {
  // Auto-load translations via require.context
  const translationsMap = getTranslations(
    require.context('./translations', false, /\.json$/i),
  );

  // Map translations to configs with display names
  const configs = Object.fromEntries(
    Object.entries(translationsMap).map(([locale, translation]) => [
      locale,
      {
        name: getLocaleDisplayName(locale),
        translation,
      },
    ]),
  );

  return Object.freeze(configs);
}

// Internal locale configurations with translations
const DEFAULT_LOCALES = getDefaultLocales();

// Available translations
const DEFAULT_RESOURCES = Object.freeze(
  Object.fromEntries(
    Object.entries(DEFAULT_LOCALES).map(([k, v]) => [
      k,
      { translation: v.translation },
    ]),
  ),
);

// Available locales
export const AVAILABLE_LOCALES = Object.freeze(
  Object.fromEntries(
    Object.entries(DEFAULT_LOCALES).map(([key, config]) => [key, config.name]),
  ),
);

/**
 * Create and initialize i18n instance immediately
 * Synchronous initialization for simplicity
 */
i18nInstance.use(initReactI18next).init({
  resources: DEFAULT_RESOURCES,
  lng: DEFAULT_LOCALE,
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
  debug: process.env.RSK_I18N_DEBUG === 'true',
});

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default i18nInstance;
