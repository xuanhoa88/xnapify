/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';

import isArray from 'lodash/isArray.js';
import mergeWith from 'lodash/mergeWith.js';

import appConfig from './config.js';
import { eslintConfigs } from './registry.factory.js';

const patterns = {
  all: '{shared,src}/**/*.{js,jsx}',
  js: '{shared,src}/**/*.js',
  jsx: '{shared,src}/**/*.jsx',
};

const config = {
  root: true,

  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true,
  },

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },

  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:css-modules/recommended',
    'plugin:prettier/recommended',
  ],

  plugins: ['react', 'react-hooks', 'jsx-a11y', 'import', 'css-modules'],

  globals: {
    NODE_ENV: 'readonly',
    __DEV__: 'readonly',
    __TEST__: 'readonly',
    __EXTENSION_ID__: 'readonly',
    __EXTENSION_DESCRIPTION__: 'readonly',
  },

  rules: {
    /* Core */
    'no-console': 'off',
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^(_|err|error|e)',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
    'no-underscore-dangle': [
      'error',
      {
        allow: ['__typename', '_formatDisplayName'],
      },
    ],

    /* Imports */
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': 'error',
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'always',
        jsx: 'always',
      },
    ],
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        pathGroups: [
          { pattern: 'react', group: 'external', position: 'before' },
          { pattern: '@shared/**', group: 'internal', position: 'after' },
          {
            pattern: '*.{css,s[ac]ss}',
            group: 'index',
            position: 'after',
            patternOptions: { matchBase: true },
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always',
      },
    ],

    /* React */
    'react/jsx-filename-extension': ['error', { extensions: ['.js', '.jsx'] }],
    'react/jsx-key': 'error',
    'react/prefer-stateless-function': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/use-memo': 'off',

    /* Accessibility */
    'jsx-a11y/anchor-is-valid': 'error',

    /* Destructuring */
    'prefer-destructuring': [
      'error',
      {
        VariableDeclarator: { object: true, array: false },
        AssignmentExpression: { object: false, array: false },
      },
      { enforceForRenamedProperties: false },
    ],

    /* Syntax restrictions */
    'no-restricted-syntax': [
      'error',
      {
        selector: 'LogicalExpression[operator="??"]',
        message: 'Nullish coalescing (??) is not allowed.',
      },
      {
        selector: 'AssignmentExpression[operator="??="]',
        message: 'Nullish coalescing assignment (??=) is not allowed.',
      },
      {
        selector: 'ChainExpression',
        message: 'Optional chaining (?.) is not allowed.',
      },
    ],

    /* Style Enforcement */
    'react/forbid-dom-props': ['error', { forbid: ['style'] }],
    'react/forbid-component-props': ['error', { forbid: ['style'] }],
  },

  settings: {
    react: { version: 'detect' },
    'import/ignore': ['node_modules'],
    'import/parsers': { espree: ['.js', '.jsx'] },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.json'],
        moduleDirectory: ['node_modules', 'src'],
      },
      alias: {
        map: [['@shared', './shared']],
        extensions: ['.js', '.jsx', '.json'],
      },
    },
  },
};

config.overrides = [
  ...eslintConfigs.map(cfg => {
    const relDir = path
      .relative(appConfig.CWD, cfg.moduleDir)
      .replace(/\\/g, '/');
    return {
      files: [`${relDir}/**/*.{js,jsx}`],
      extends: [cfg.path],
    };
  }),
  {
    files: [
      'src/apps/**/*.js',
      'src/extensions/**/*.js',
      'src/infrastructure/**/*.js',
      'shared/renderer/**/*.js',
    ],
    rules: {
      'react/forbid-dom-props': 'off',
      'react/forbid-component-props': 'off',
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-redeclare': 'off',
    },
  },
  {
    files: [
      'shared/renderer/components/SearchableSelect/**/*.js',
      'shared/renderer/components/Modal/**/*.js',
      'shared/renderer/components/ContextMenu/**/*.js',
      'src/apps/extensions/views/(admin)/hub/components/CategoryChips.js',
      'src/extensions/quick-access-plugin/views/QuickAccess.js',
      'src/extensions/posts-module/views/(admin)/(default)/PostForm.js',
      'src/extensions/posts-module/views/(admin)/(default)/SeoPreview.js',
    ],
    rules: {
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
    },
  },
];

/**
 * Creates an extended ESLint configuration by deep merging user configs.
 * Arrays (like plugins, extends) are concatenated rather than overwritten.
 *
 * @param {Object} customConfig - User overrides
 * @returns {Object} Merged ESLint configuration
 */
export function createConfig(customConfig = {}) {
  return mergeWith({}, config, customConfig, (objValue, srcValue) => {
    if (isArray(objValue)) {
      return objValue.concat(srcValue);
    }
  });
}

export default config;

export { patterns };
