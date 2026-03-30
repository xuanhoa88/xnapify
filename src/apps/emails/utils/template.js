/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Regex to capture LiquidJS output expressions: {{ expr }}
 * Captures the full inner content (group 1) for further parsing.
 */
const LIQUID_OUTPUT_REGEX = /\{\{\s*(.*?)\s*\}\}/g;

/**
 * Checks whether an expression is a LiquidJS literal (not a data variable).
 *
 * Literals include:
 * - Quoted strings:  "now", 'hello'
 * - Numbers:         42, 3.14
 * - Booleans:        true, false
 * - nil/null/empty:  nil, null, empty, blank
 *
 * @param {string} expr - The raw expression inside {{ }}
 * @returns {boolean}
 */
function isLiteral(expr) {
  const base = expr.split('|')[0].trim();
  return (
    /^["']/.test(base) ||
    /^-?\d/.test(base) ||
    /^(true|false|nil|null|empty|blank)$/i.test(base)
  );
}

/**
 * Parses a template string and extracts all unique data variable names.
 *
 * Correctly handles:
 * - Simple variables:          {{ appName }}         → "appName"
 * - Dotted paths:              {{ user.profile }}    → "user.profile"
 * - Variables with filters:    {{ name | upcase }}   → "name"
 * - String literals:           {{ "now" | date: … }} → skipped
 * - Numeric literals:          {{ 42 | plus: 1 }}    → skipped
 * - Boolean/nil literals:      {{ true }}            → skipped
 *
 * @param {string} text - The template text to parse
 * @returns {string[]} Array of unique variable names sorted alphabetically
 */
export function extractVariables(text) {
  if (!text) return [];

  const vars = new Set();

  for (const match of text.matchAll(LIQUID_OUTPUT_REGEX)) {
    const inner = match[1].trim();
    if (!inner || isLiteral(inner)) continue;

    // Extract the variable name (everything before the first pipe/filter)
    const varPart = inner.split('|')[0].trim();

    // Validate: must be a valid identifier (letters, digits, underscores, dots)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(varPart)) {
      vars.add(varPart);
    }
  }

  return [...vars].sort();
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
