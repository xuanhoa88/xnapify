/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import defaultI18nInstance from './getInstance';

/**
 * Add a new namespace with translations for all available locales
 * This allows feature modules to provide their own translations
 *
 * @param {string} namespace - The namespace identifier (e.g., 'zod', 'common')
 * @param {Object} translations - Object mapping locale codes to translation objects
 *   Example: { 'en-US': {...}, 'vi-VN': {...} }
 * @param {Object} [i18nInstance] - Optional i18n instance to register with (defaults to imported instance)
 */
export function addNamespace(namespace, translations, i18nInstance) {
  // Validate inputs
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('Namespace must be a non-empty string');
  }

  if (!translations || typeof translations !== 'object') {
    throw new Error(
      'Translations must be an object mapping locale codes to translation objects',
    );
  }

  // Use provided instance or fallback to default
  const i18n = i18nInstance || defaultI18nInstance;

  try {
    // Check if i18n instance is ready
    if (!i18n || !i18n.options) {
      if (__DEV__) {
        console.warn(
          '[i18n] Instance not ready when registering namespace:',
          namespace,
        );
      }
      // If not ready, we might want to queue it or it might be registered during init if passed to resources
      return;
    }

    // Add the namespace to the list if not already present
    if (i18n.options.ns && !i18n.options.ns.includes(namespace)) {
      i18n.options.ns.push(namespace);
    }

    // Add translations for each locale
    Object.entries(translations).forEach(([locale, translation]) => {
      if (!i18n.hasResourceBundle(locale, namespace)) {
        i18n.addResourceBundle(locale, namespace, translation, true, true);
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
