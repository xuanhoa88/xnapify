/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import path from 'path';

import isArray from 'lodash/isArray.js';
import mergeWith from 'lodash/mergeWith.js';

import appConfig from '../config.js';

import { stylelintConfigs } from './registry.factory.js';

const filePatterns = {
  all: 'src/**/*.{css,scss,sass}',
  css: 'src/**/*.css',
  scss: 'src/**/*.{scss,sass}',
};

const config = {
  extends: ['stylelint-config-standard'],

  patterns: filePatterns,

  rules: {
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
};

config.overrides = [
  ...stylelintConfigs.map(cfg => {
    const relDir = path
      .relative(appConfig.CWD, cfg.moduleDir)
      .replace(/\\/g, '/');
    return {
      files: [`${relDir}/**/*.{css,scss,sass}`],
      extends: [cfg.path],
    };
  }),
];

/**
 * Creates an extended Stylelint configuration by deep merging user configs.
 * Arrays (like plugins, extends) are concatenated rather than overwritten.
 *
 * @param {Object} customConfig - User overrides
 * @returns {Object} Merged Stylelint configuration
 */
export function createConfig(customConfig = {}) {
  return mergeWith({}, config, customConfig, (objValue, srcValue) => {
    if (isArray(objValue)) {
      return objValue.concat(srcValue);
    }
  });
}

export default config;

export { filePatterns as patterns };
