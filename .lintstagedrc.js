/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// lint-staged configuration
// https://github.com/okonet/lint-staged
export default {
  // JavaScript, JSX, and TypeScript files
  '*.{js,jsx,ts,tsx}': ['npm run fix:js', 'npm run format'],

  // CSS, SCSS files
  '*.{css,scss,sass}': ['npm run fix:css', 'npm run format'],

  // Markdown, JSON, YAML files
  '*.{md,mdx,json,yml,yaml}': ['npm run format'],
};
