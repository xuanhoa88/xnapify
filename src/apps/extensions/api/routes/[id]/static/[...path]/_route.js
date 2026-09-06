/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as extensionController from '../../../../controllers/extension.controller.js';

/**
 * Extension assets are served unauthenticated, so this route is the one place
 * an anonymous caller can probe extension ids. Extension ids are deployment
 * independent (a pure function of the package name), which makes an unmetered
 * probe a reliable way to enumerate which extensions a deployment runs.
 *
 * The budget is generous — a single page load pulls every active extension's
 * CSS and JS — but it is finite, so enumeration is no longer free.
 */
export const useRateLimit = { max: 600, windowMs: 60_000 };

export const get = [extensionController.serveExtensionStatic];
