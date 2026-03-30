/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const filePatterns = {
  all: 'src/**/*.{css,less,styl,scss,sass,sss}',
  css: 'src/**/*.css',
  scss: 'src/**/*.scss',
  sass: 'src/**/*.sass',
};

module.exports = {
  extends: ['stylelint-config-standard', 'stylelint-config-prettier'],

  patterns: filePatterns,

  rules: {
    // Prettier compatibility
    'declaration-colon-newline-after': null,
    'value-list-comma-newline-after': null,

    // Allow redundant longhand properties
    'declaration-block-no-redundant-longhand-properties': null,

    // CSS Modules support
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],

    // Allow :global and :local only
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['global', 'local'] },
    ],

    // Allow any naming style: CamelCase, PascalCase, kebab-case, etc.
    'selector-class-pattern': null,

    // Avoid false errors with Tailwind, PostCSS, HTML, SCSS, etc.
    'at-rule-no-unknown': null,

    // Allow any naming style: CamelCase, PascalCase, kebab-case, etc.
    'keyframes-name-pattern': null,
  },

  overrides: [
    {
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss',
    },
  ],
};
