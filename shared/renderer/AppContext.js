/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React, { useContext } from 'react';

/**
 * React Context for the global application context.
 * Enables dependency injection for deeply nested components (like extensions)
 * without prop drilling or relying on global singletons that break SSR.
 */
export const AppContext = React.createContext(null);

/**
 * Hook to consume the AppContext
 * @returns {Object} The application context
 */
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    if (__DEV__) {
      console.warn(
        'useAppContext must be used within an <AppContext.Provider>',
      );
    }
  }
  return context;
}
