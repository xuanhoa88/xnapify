/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 *
 * NOTE: This module assumes `__DEV__` is defined as a global boolean by your
 * bundler (e.g. Webpack DefinePlugin or Vite's `define` config).
 */

import { resolveInstance, getStoreLocales } from './getInstance';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} namespace
 */
function validateNamespace(namespace) {
  if (!namespace || typeof namespace !== 'string') {
    const err = new Error('Namespace must be a non-empty string');
    err.name = 'InvalidNamespaceError';
    err.status = 400;
    throw err;
  }
}

/**
 * @param {Object} translations
 */
function validateTranslations(translations) {
  if (
    !translations ||
    typeof translations !== 'object' ||
    Array.isArray(translations)
  ) {
    const err = new Error(
      'Translations must be an object mapping locale codes to translation objects',
    );
    err.name = 'InvalidTranslationsError';
    err.status = 400;
    throw err;
  }
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a new namespace with translations for all available locales.
 * Safe for HMR and repeated calls.
 *
 * @param {string} namespace
 * @param {Object} translations - e.g. `{ 'en-US': { key: 'value' }, 'vi-VN': { key: 'giá trị' } }`
 * @param {import('i18next').i18n} [i18nInstance]
 * @returns {boolean} `true` if the operation succeeded, `false` otherwise
 */
export function addNamespace(namespace, translations, i18nInstance) {
  validateNamespace(namespace);
  validateTranslations(translations);

  const i18n = resolveInstance(i18nInstance);
  if (!i18n) return false;

  try {
    // Ensure namespace list exists
    if (!Array.isArray(i18n.options.ns)) {
      i18n.options.ns = [];
    }

    // Add namespace to config if missing
    if (!i18n.options.ns.includes(namespace)) {
      i18n.options.ns.push(namespace);
    }

    // Merge translations for each locale
    Object.entries(translations).forEach(([locale, translation]) => {
      i18n.addResourceBundle(locale, namespace, translation, true, true);

      if (__DEV__) {
        console.log(
          `[i18n] Registered namespace '${namespace}' for locale '${locale}'`,
        );
      }
    });

    return true;
  } catch (error) {
    console.error('[i18n] Failed to register namespace:', namespace, error);
    return false;
  }
}

/**
 * Remove a namespace from all locales.
 *
 * @param {string} namespace
 * @param {import('i18next').i18n} [i18nInstance]
 * @returns {boolean} `true` if the operation succeeded, `false` otherwise
 */
export function removeNamespace(namespace, i18nInstance) {
  validateNamespace(namespace);

  const i18n = resolveInstance(i18nInstance);
  if (!i18n) return false;

  try {
    const { ns = [] } = i18n.options;

    // Remove from namespace list
    i18n.options.ns = ns.filter(n => n !== namespace);

    // Use store data for reliable locale iteration (not options.resources)
    getStoreLocales(i18n).forEach(locale => {
      if (i18n.hasResourceBundle(locale, namespace)) {
        i18n.removeResourceBundle(locale, namespace);
      }
    });

    if (__DEV__) {
      console.log(`[i18n] Removed namespace '${namespace}'`);
    }

    return true;
  } catch (error) {
    console.error('[i18n] Failed to remove namespace:', namespace, error);
    return false;
  }
}

/**
 * Check if a namespace is registered AND has at least one resource bundle
 * loaded in the store. Checking both guards against the case where a namespace
 * is listed in `options.ns` but has no actual translations, or vice versa.
 *
 * @param {string} namespace
 * @param {import('i18next').i18n} [i18nInstance]
 * @returns {boolean}
 */
export function hasNamespace(namespace, i18nInstance) {
  validateNamespace(namespace);

  const i18n = resolveInstance(i18nInstance);
  if (!i18n) return false;

  const { ns = [] } = i18n.options;

  const inNamespaceList = ns.includes(namespace);
  const hasBundle = getStoreLocales(i18n).some(locale =>
    i18n.hasResourceBundle(locale, namespace),
  );

  return inNamespaceList && hasBundle;
}

/**
 * Ensure a namespace is loaded, lazy-loading it via `loader` if not.
 * Useful for code-splitting at the route or feature level.
 *
 * Note: `i18nInstance` is intentionally passed as the third argument here —
 * `hasNamespace(namespace, i18nInstance)` uses the same signature convention.
 *
 * @param {string} namespace
 * @param {() => Promise<Object>} loader - async function returning a translations object
 * @param {import('i18next').i18n} [i18nInstance]
 * @returns {Promise<boolean>} `true` if namespace was already loaded or loaded successfully
 */
export async function ensureNamespaceLoaded(namespace, loader, i18nInstance) {
  validateNamespace(namespace);

  const i18n = resolveInstance(i18nInstance);
  if (!i18n) return false;

  if (hasNamespace(namespace, i18n)) {
    return true;
  }

  try {
    const translations = await loader();
    validateTranslations(translations);
    return addNamespace(namespace, translations, i18n);
  } catch (error) {
    console.error(`[i18n] Failed to lazy load namespace '${namespace}'`, error);
    return false;
  }
}
