/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get a runtime variable by name
 *
 * @param {Object} state - Redux state
 * @param {string} name - Variable name
 * @param {*} defaultValue - Default value if variable doesn't exist
 * @returns {*} Variable value or defaultValue
 */
export const getRuntimeVariable = (state, name, defaultValue) => {
  const value = state.runtime && state.runtime[name];
  return value != null ? value : defaultValue;
};
