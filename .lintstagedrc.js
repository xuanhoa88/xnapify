/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// lint-staged configuration
// https://github.com/okonet/lint-staged
module.exports = {
  // JavaScript and JSX files
  '*.{js,jsx}': ['eslint --fix', 'prettier --write'],

  // TypeScript files (if added in the future)
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],

  // CSS, SCSS, LESS files
  '*.{css,scss,sass,less,styl,sss}': ['stylelint --fix', 'prettier --write'],

  // Markdown, JSON, YAML files
  '*.{md,mdx,json,yml,yaml}': ['prettier --write'],

  // Package.json files
  'package.json': ['prettier --write'],

  // Configuration files
  '*.{json,js,ts}': ['prettier --write'],
};
