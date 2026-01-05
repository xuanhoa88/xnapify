/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Public API - Selectors
export {
  // Typed selectors for known runtime variables
  getAppName,
  getAppDescription,
  getInitialNow,
  // Generic selector for custom variables
  getRuntimeVariable,
} from './selector';

// Public API - Actions (from slice)
export { setRuntimeVariable, resetRuntimeState } from './slice';

// Public API - Reducer
export { default } from './slice';
