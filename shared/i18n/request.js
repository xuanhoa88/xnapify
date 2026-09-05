/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { DEFAULT_LOCALE } from './constants.js';
import defaultInstance from './getInstance.js';

/**
 * Create an i18next instance scoped to a single SSR request.
 *
 * The process-wide instance must never have its language switched per
 * request: React streaming interleaves concurrent renders, so a
 * `changeLanguage()` issued for one request leaks into every render that is
 * in flight. A clone shares the resource store (translations registered by
 * modules and extensions stay visible) but carries its own language state,
 * so each request renders in exactly the locale it negotiated.
 *
 * `initImmediate: false` makes the clone initialise synchronously — all
 * resources are already in the shared store, nothing is loaded lazily.
 *
 * @param {string} locale - Locale negotiated for the request (e.g. 'vi-VN')
 * @param {import('i18next').i18n} [base] - Instance to clone (defaults to the app singleton)
 * @returns {import('i18next').i18n} Request-scoped instance
 */
export function createRequestI18n(locale, base = defaultInstance) {
  if (!base || typeof base.cloneInstance !== 'function') {
    const err = new Error('i18n base instance does not support cloning');
    err.name = 'I18nCloneError';
    err.status = 500;
    throw err;
  }

  const lng =
    typeof locale === 'string' && locale.trim().length > 0
      ? locale
      : DEFAULT_LOCALE;

  return base.cloneInstance({ lng, initImmediate: false });
}

export default createRequestI18n;
