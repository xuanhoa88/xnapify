/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createContext } from 'react';

/**
 * React Context for the global application context.
 * Enables dependency injection for deeply nested components (like extensions)
 * without prop drilling or relying on global singletons that break SSR.
 */
export const AppContext = createContext(null);
