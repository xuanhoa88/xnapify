/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import ExtensionRegistry from '../utils/Registry';

/**
 * Client-side extension registry singleton.
 * Isolated from the server registry — extensions registered here use
 * the view container context.
 */
export const registry = new ExtensionRegistry();

export default ExtensionRegistry;
