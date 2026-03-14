/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Regex to capture anything inside {{ }} - specifically the variable name inside it
export const LIQUID_VAR_REGEX = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

/**
 * Parses a string to extract all unique liquid template variables.
 *
 * @param {string} text - The template text to parse
 * @returns {string[]} Array of unique variable names sorted alphabetically
 */
export function extractVariables(text) {
  if (!text) return [];
  const matches = [...text.matchAll(LIQUID_VAR_REGEX)];
  const vars = matches.map(match => match[1]);
  return [...new Set(vars)].sort();
}

/**
 * Creates a sample data object from an array of variable names,
 * mapping each name to its placeholder string.
 *
 * @param {string[]} variables - Array of variable names
 * @returns {Object} Sample data object
 */
export function createPlaceholderData(variables) {
  if (!variables || !Array.isArray(variables)) return {};
  return variables.reduce((acc, v) => {
    acc[v] = `{{ ${v} }}`;
    return acc;
  }, {});
}
