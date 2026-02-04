/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18nInstance from './getInstance';
import { getTranslations } from './getTranslations';
import { addNamespace } from './addNamespace';

// Export utilities
export { getTranslations, addNamespace };

// Export constants
export * from './constants';

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
/**
 * Initialize i18n resources
 * We iterate through the loaded resources and add them to the already initialized instance
 */
Object.entries(DEFAULT_RESOURCES).forEach(([locale, resource]) => {
  i18nInstance.addResourceBundle(
    locale,
    'translation',
    resource.translation,
    true,
    true,
  );
});

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default i18nInstance;
