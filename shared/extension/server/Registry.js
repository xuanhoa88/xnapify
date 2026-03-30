/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ExtensionRegistry from '../utils/Registry';

/**
 * Server-side extension registry singleton.
 * Isolated from the client registry — extensions registered here use
 * the API container context.
 */
export const registry = new ExtensionRegistry();

export default ExtensionRegistry;
