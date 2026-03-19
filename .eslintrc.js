/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const patterns = {
  all: '{shared,src}/**/*.{js,jsx}',
  js: '{shared,src}/**/*.js',
  jsx: '{shared,src}/**/*.jsx',
};

const config = {
  root: true,

  parser: '@babel/eslint-parser',

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

    requireConfigFile: false,

    babelOptions: {
      presets: ['@babel/preset-react'],
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

    __PLUGIN_NAME__: 'readonly',
    __PLUGIN_DESCRIPTION__: 'readonly',
  },

  rules: {
    /*
     * Core
     */

    'no-console': 'off',

    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    'no-underscore-dangle': [
      'error',
      {
        allow: ['__typename'],
      },
    ],

    /*
     * Imports
     */

    'import/no-extraneous-dependencies': 'off',

    'import/no-unresolved': 'error',

    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',

    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
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
          {
            pattern: 'react',
            group: 'external',
            position: 'before',
          },
          {
            pattern: '@shared/**',
            group: 'internal',
            position: 'after',
          },
          {
            pattern: '*.{css,s[ac]ss,less,styl,sss}',
            group: 'index',
            position: 'after',
            patternOptions: { matchBase: true },
          },
        ],

        pathGroupsExcludedImportTypes: ['builtin'],

        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },

        'newlines-between': 'always',
      },
    ],

    /*
     * React
     */

    'react/jsx-filename-extension': [
      'error',
      {
        extensions: ['.js', '.jsx'],
      },
    ],

    'react/jsx-key': 'error',

    'react/prefer-stateless-function': 'off',

    /*
     * Accessibility
     */

    'jsx-a11y/anchor-is-valid': 'error',

    /*
     * Destructuring
     */

    'prefer-destructuring': [
      'error',
      {
        VariableDeclarator: {
          object: true,
          array: false,
        },
        AssignmentExpression: {
          object: false,
          array: false,
        },
      },
      {
        enforceForRenamedProperties: false,
      },
    ],

    /*
     * Syntax restrictions
     */

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
  },

  settings: {
    react: {
      version: 'detect',
    },

    'import/parsers': {
      '@babel/eslint-parser': ['.js', '.jsx'],
    },

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

module.exports = config;

Object.defineProperty(module.exports, 'patterns', {
  value: patterns,
  enumerable: false,
  writable: false,
  configurable: false,
});
