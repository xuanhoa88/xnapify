/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

import { createConfig } from './tools/factories/eslint.factory.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilename);

// Parse .lintignore natively for Flat Config to act as single source of truth
const eslintIgnorePath = path.join(currentDir, '.lintignore');
const parsedIgnores = fs.existsSync(eslintIgnorePath)
  ? fs
      .readFileSync(eslintIgnorePath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
  : [];

const compat = new FlatCompat({
  baseDirectory: currentDir,
  resolvePluginsRelativeTo: currentDir,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: parsedIgnores,
  },
  ...compat.config(createConfig()),
];
