/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18nInstance from './getInstance.js';
import { getTranslations } from './loader.js';
import { addNamespace } from './utils.js';

// Export utilities
export { getTranslations, addNamespace };

// Export constants
export * from './constants.js';

// Get all translations from the translations directory
const translationsContext = import.meta.webpackContext('./translations', {
  recursive: false,
  regExp: /\.json$/i,
});

/**
 * Get display name for a locale using native Intl.DisplayNames API
 * @param {string} locale - The locale code (e.g., 'en-US', 'vi-VN')
 * @returns {string} Display name for the locale
 */
function getLanguageName(locale) {
  try {
    // Extract language code from locale (e.g., 'en' from 'en-US')
    const [language] = locale.split('-');

    // Use Intl.DisplayNames to get the native name of the language
    const displayNames = new Intl.DisplayNames([locale], {
      type: 'language',
    });
    const name = displayNames.of(language);
    return name || locale;
  } catch (error) {
    // Fallback to the locale code if Intl.DisplayNames fails
    console.warn(`Failed to get display name for locale ${locale}:`, error);
    return locale;
  }
}

/**
 * Get default locale resources and available locales
 * @returns {[Object, Object]} [resources, locales]
 * - resources: { locale: { translation } }
 * - locales: { locale: displayName }
 */
function getLocalesConfig() {
  const translationsMap = getTranslations(translationsContext);
  const resources = Object.fromEntries(
    Object.entries(translationsMap).map(([locale, translation]) => [
      locale,
      {
        translation,
      },
    ]),
  );
  const locales = Object.freeze(
    Object.fromEntries(
      Object.keys(translationsMap).map(locale => [
        locale,
        getLanguageName(locale),
      ]),
    ),
  );
  return [resources, locales];
}

// Internal locale configurations with translations
const [DEFAULT_RESOURCES, AVAILABLE_LOCALES] = getLocalesConfig();
export { DEFAULT_RESOURCES, AVAILABLE_LOCALES };

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
// BUILT-IN NAMESPACES
// =============================================================================

// Register the 'common' namespace — cross-cutting UI labels
// (retry, cancel, delete, save, etc.)
const commonContext = import.meta.webpackContext('./namespaces/common', {
  recursive: false,
  regExp: /\.json$/i,
});
addNamespace('common', getTranslations(commonContext));

// Register the 'admin' namespace — shared admin panel labels
// (navigation, common admin UI, buttons, error messages)
const adminContext = import.meta.webpackContext('./namespaces/admin', {
  recursive: false,
  regExp: /\.json$/i,
});
addNamespace('admin', getTranslations(adminContext));

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default i18nInstance;
