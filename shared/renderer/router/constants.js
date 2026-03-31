/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
/** @type {symbol} Tracks whether a route's init() has been called */
export const ROUTE_INIT_KEY = Symbol('__xnapify.route.init__');
/** @type {symbol} Tracks mounted config modules to prevent double-mounting */
export const ROUTE_MOUNT_KEY = Symbol('__xnapify.route.mount__');
/** @type {symbol} Tracks unmounted config modules to prevent double-unmounting */
export const ROUTE_UNMOUNT_KEY = Symbol('__xnapify.route.unmount__');
/** @type {symbol} Stores reference to previously matched route (for unmount) */
export const ROUTE_PREV_KEY = Symbol('__xnapify.route.previous__');
/** @type {symbol} Stores the previous route's context (for unmount) */
export const ROUTE_PREV_CTX = Symbol('__xnapify.route.previousCtx__');
/** @type {symbol} Tracks whether a route's translations have been registered */
export const ROUTE_TRANSLATIONS_KEY = Symbol('__xnapify.route.translations__');
