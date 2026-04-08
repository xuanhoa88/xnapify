/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const { BuildError } = require('./error');

/**
 * Resolve Jest binary path
 * @param {string} cwd - Current working directory
 * @returns {string} Jest binary path
 */
function resolveJestBin(cwd) {
  // Safely execute using Node itself if we can resolve the binary directly
  let jestBin;

  const jestBinTargets = ['jest/bin/jest.js', 'jest-cli/bin/jest.js'];
  for (const target of jestBinTargets) {
    try {
      jestBin = require.resolve(target);
      break;
    } catch {
      // Continue looking
    }
  }

  if (!jestBin) {
    const possiblePaths = [
      path.resolve(require.resolve('jest'), '../../bin/jest.js'),
      path.resolve(cwd, 'node_modules/jest/bin/jest.js'),
      path.resolve(cwd, 'node_modules/jest-cli/bin/jest.js'),
      path.resolve(cwd, 'node_modules/.bin/jest'),
      path.resolve(cwd, 'node_modules/.bin/jest-cli'),
    ];
    jestBin = possiblePaths.find(p => fs.existsSync(p));
  }

  if (!jestBin) {
    throw new BuildError('Could not find Jest binary', { exitCode: 1 });
  }

  return jestBin;
}

module.exports = {
  resolveJestBin,
};
