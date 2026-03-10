/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createWebpackContextAdapter } from '@shared/utils/webpackContextAdapter';

/**
 * Get translations from a require.context object (wrapped in adapter)
 * This is a utility function that can be reused across the application
 *
 * @param {Object} translationAdapter - Webpack require.context or Context Adapter
 * @returns {Object} Object mapping locale codes to translation objects
 */
export function getTranslations(translationAdapter) {
  const translations = {};

  // Ensure we have an adapter interface
  const adapter = translationAdapter.files
    ? translationAdapter
    : createWebpackContextAdapter(translationAdapter);

  adapter.files().forEach(filename => {
    // Extract locale from filename (e.g., 'en-US' from './en-US.json' or any path)
    // Match the basename without extension using regex
    const match = filename.match(/([^/]+)\.json$/i);
    if (!match) return; // Skip if doesn't match expected pattern
    const locale = match[1];
    const translation = adapter.load(filename);

    translations[locale] = translation;
  });

  return translations;
}
