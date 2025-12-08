/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SET_RUNTIME_VARIABLE } from './constants';

/**
 * Set runtime variable(s)
 *
 * Sets one or more runtime variables by merging the payload into the runtime state.
 *
 * @param {Object} payload - Object with variable name/value pairs
 * @returns {Object} Redux action
 *
 * @example
 * // Single variable
 * dispatch(setRuntimeVariable({ appName: 'My App' }));
 *
 * @example
 * // Multiple variables
 * dispatch(setRuntimeVariable({
 *   initialNow: Date.now(),
 *   appName: 'React Starter Kit',
 *   appDescription: 'Boilerplate...'
 * }));
 */
export function setRuntimeVariable(payload) {
  return {
    type: SET_RUNTIME_VARIABLE,
    payload,
  };
}
