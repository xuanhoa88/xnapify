/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// File patterns to lint
const patterns = {
  all: 'src/**/*.{js,jsx}',
  js: 'src/**/*.js',
  jsx: 'src/**/*.jsx',
};

const config = {
  // Use @babel/eslint-parser for modern JavaScript/JSX
  parser: '@babel/eslint-parser',

  // Extend recommended configurations
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:css-modules/recommended',
    'prettier',
  ],

  // Plugins for additional linting capabilities
  plugins: [
    'import',
    'jsx-a11y',
    'react',
    'react-hooks',
    'css-modules',
    'prettier',
  ],

  // Global variables available in the code
  globals: {
    NODE_ENV: true,
    __DEV__: true,
    __TEST__: true,
    // Plugin build globals (injected via webpack DefinePlugin)
    __PLUGIN_NAME__: 'readonly',
    __PLUGIN_DESCRIPTION__: 'readonly',
  },

  // Environment settings
  env: {
    browser: true,
    node: true,
    es2021: true,
    jest: true,
  },

  // Parser options for modern JavaScript
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
  },

  rules: {
    // Allow console statements (useful for debugging and build tools)
    'no-console': 'off',

    // Allow unused vars for React (new JSX runtime doesn't require React import)
    // https://eslint.org/docs/rules/no-unused-vars
    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // Allow importing devDependencies (common in starter kits)
    'import/no-extraneous-dependencies': 'off',

    // Allow unresolved imports for build-generated files
    'import/no-unresolved': ['error'],

    // Allow named imports as default (common pattern)
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',

    // Allow only special identifiers
    // https://eslint.org/docs/rules/no-underscore-dangle
    'no-underscore-dangle': [
      'error',
      {
        allow: ['__typename'],
      },
    ],

    // Prefer destructuring from arrays and objects
    // http://eslint.org/docs/rules/prefer-destructuring
    'prefer-destructuring': [
      'error',
      {
        VariableDeclarator: {
          array: false,
          object: true,
        },
        AssignmentExpression: {
          array: false,
          object: false,
        },
      },
      {
        enforceForRenamedProperties: false,
      },
    ],

    // Ensure <a> tags are valid
    // https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/anchor-is-valid.md
    'jsx-a11y/anchor-is-valid': ['error'],

    // Allow .js files to use JSX syntax
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-filename-extension.md
    'react/jsx-filename-extension': ['error', { extensions: ['.js', '.jsx'] }],

    // Functional and class components are equivalent from React’s point of view
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/prefer-stateless-function.md
    'react/prefer-stateless-function': 'off',

    // ESLint plugin for prettier formatting
    // https://github.com/prettier/eslint-plugin-prettier
    'prettier/prettier': 'error',

    // Allow file extensions for certain imports
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
      },
    ],

    // Disable nullish coalescing (??) and optional chaining (?.)
    'no-restricted-syntax': [
      'error',
      {
        selector: 'LogicalExpression[operator="??"]',
        message: 'Nullish coalescing (??) is not allowed.',
      },
      {
        selector: 'ChainExpression',
        message: 'Optional chaining (?.) is not allowed.',
      },
    ],
  },

  settings: {
    // React version detection
    react: {
      version: 'detect',
    },

    // Allow absolute paths in imports, e.g. import Button from 'components/Button'
    // https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers
    'import/resolver': {
      alias: {
        map: [['@shared', './shared']],
        extensions: ['.js', '.jsx', '.json'],
      },
      node: {
        extensions: ['.js', '.jsx', '.json'],
        moduleDirectory: ['node_modules', 'src'],
      },
    },
  },
};

// Export config and attach patterns as non-enumerable property
// This prevents patterns from being spread into ESLint config
module.exports = config;

// Make patterns available but non-enumerable
Object.defineProperty(module.exports, 'patterns', {
  value: patterns,
  enumerable: false, // Prevents it from being spread into ESLint config
  writable: false,
  configurable: false,
});
