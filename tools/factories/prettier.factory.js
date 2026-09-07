/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Canonical Prettier configuration.
 *
 * It lives here rather than in the repo root for the same reason the ESLint and
 * Stylelint configurations do: `tools/` is a standalone package and must not
 * import from outside itself, so the format task cannot reach up to
 * `../../prettier.config.js`. The root `prettier.config.js` re-exports this, so
 * editors and `npx prettier` — which discover config by walking up from the
 * file being formatted — keep finding it exactly where they expect.
 *
 * One definition, two entry points: `npm run format` reads it through
 * `tools/tasks/prettier.js`, everything else through the root re-export.
 *
 * @returns {Object} Prettier options
 */
export function createConfig() {
  return {
    // Line wrapping
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,

    // Quotes and punctuation
    singleQuote: true,
    trailingComma: 'all',
    semi: true,

    // Spacing
    bracketSpacing: true,
    arrowParens: 'avoid',

    // JSX
    jsxSingleQuote: true,

    // Line endings
    endOfLine: 'lf',
  };
}

export default createConfig();
