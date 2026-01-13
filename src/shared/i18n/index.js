/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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
 * Get translations from a require.context object
 * This is a utility function that can be reused across the application
 *
 * @param {Function} translationContext - require.context object for translation files
 * @returns {Object} Object mapping locale codes to translation objects
 *
 * @example
 * const context = require.context('./translations', false, /\.json$/);
 * const translations = getTranslations(context);
 * // Returns: { 'en-US': {...}, 'vi-VN': {...} }
 */
export function getTranslations(translationContext) {
  const translations = {};

  translationContext.keys().forEach(filename => {
    // Extract locale from filename (e.g., 'en-US' from './en-US.json' or any path)
    // Match the basename without extension using regex
    const match = filename.match(/([^/]+)\.json$/i);
    if (!match) return; // Skip if doesn't match expected pattern
    const locale = match[1];
    const translation = translationContext(filename);

    translations[locale] = translation;
  });

  return translations;
}

/**
 * Get all locale configurations dynamically using require.context
 * Works for both server and client since webpack bundles both
 * @returns {Object} Frozen object mapping locale codes to { name, translation }
 */
function getDefaultLocales() {
  // Get translations from the translations directory
  const translationsContext = getTranslations(
    require.context('./translations', false, /\.json$/i),
  );

  // Map translations to configs with display names
  const configs = Object.fromEntries(
    Object.entries(translationsContext).map(([locale, translation]) => [
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
const i18nInstance = i18n.createInstance();
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

/**
 * Add a new namespace with translations for all available locales
 * This allows feature modules to provide their own translations
 *
 * @param {string} namespace - The namespace identifier (e.g., 'zod', 'common')
 * @param {Object} translations - Object mapping locale codes to translation objects
 *   Example: { 'en-US': {...}, 'vi-VN': {...} }
 *
 * @example
 * addNamespace('zod', {
 *   'en-US': zodEnUS,
 *   'vi-VN': zodViVN,
 * });
 */
export function addNamespace(namespace, translations) {
  // Validate inputs
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('Namespace must be a non-empty string');
  }

  if (!translations || typeof translations !== 'object') {
    throw new Error(
      'Translations must be an object mapping locale codes to translation objects',
    );
  }

  try {
    // Check if i18n instance is ready
    if (!i18nInstance || !i18nInstance.options) {
      console.error(
        '[i18n] Instance not ready when trying to register namespace:',
        namespace,
      );
      return;
    }

    // Add the namespace to the list if not already present
    if (!i18nInstance.options.ns.includes(namespace)) {
      i18nInstance.options.ns.push(namespace);
    }

    // Add translations for each locale
    Object.entries(translations).forEach(([locale, translation]) => {
      if (!i18nInstance.hasResourceBundle(locale, namespace)) {
        i18nInstance.addResourceBundle(
          locale,
          namespace,
          translation,
          true,
          true,
        );
        if (__DEV__) {
          console.log(
            `[i18n] Registered namespace '${namespace}' for locale '${locale}'`,
          );
        }
      }
    });
  } catch (error) {
    console.error('[i18n] Failed to register namespace:', namespace, error);
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default i18nInstance;
