/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import i18nInstance from './instance';

/**
 * Add a new namespace with translations for all available locales
 * This allows feature modules to provide their own translations
 *
 * @param {string} namespace - The namespace identifier (e.g., 'zod', 'common')
 * @param {Object} translations - Object mapping locale codes to translation objects
 *   Example: { 'en-US': {...}, 'vi-VN': {...} }
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
    if (
      i18nInstance.options.ns &&
      !i18nInstance.options.ns.includes(namespace)
    ) {
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
