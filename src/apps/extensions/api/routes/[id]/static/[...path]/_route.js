/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as extensionController from '../../../../controllers/extension.controller';

export const useRateLimit = false;
export const get = [extensionController.serveExtensionStatic];
