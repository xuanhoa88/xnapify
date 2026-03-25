/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/** @type {string} Empty string representing the root path in matching */
export const ROUTE_PATH_ROOT = '';
/** @type {string} Forward slash path separator */
export const ROUTE_SEPARATOR = '/';
/** @type {string} Default module/config placeholder name */
export const ROUTE_PATH_DEFAULT = '(default)';
/** @type {symbol} Tracks whether a route's boot() has been called */
export const ROUTE_BOOT_KEY = Symbol('__rsk.routeBootKey__');
/** @type {symbol} Tracks mounted config modules to prevent double-mounting */
export const ROUTE_MOUNT_KEY = Symbol('__rsk.routeMountKey__');
/** @type {symbol} Tracks whether a route's translations have been registered */
export const ROUTE_TRANSLATIONS_KEY = Symbol('__rsk.routeTranslationsKey__');
