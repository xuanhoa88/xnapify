/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Public API - Config (re-export for backward compatibility)
export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_MAX_AGE,
  AVAILABLE_LOCALES,
  getI18nInstance,
} from './config';

// Public API - Async Thunks
export * from './thunks';

// Public API - Selectors
export * from './selector';

// Public API - Reducer
export { default } from './slice';
