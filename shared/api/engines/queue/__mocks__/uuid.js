/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Mock for uuid
 * Jest can't handle uuid's node:crypto imports
 */

let counter = 0;

export const resetCounter = () => {
  counter = 0;
};

/**
 * A plain function, deliberately NOT `jest.fn(impl)`.
 *
 * This is a manual mock for a *node module*, so jest-haste-map applies it
 * automatically to every suite in the project — no `jest.mock('uuid')` needed.
 * `tools/jest/config.js` sets `resetMocks: true`, and resetAllMocks strips the
 * implementation out of any `jest.fn(impl)` created at module load. The mock
 * then returned `undefined` for every id in every suite that did not declare
 * its own uuid factory, which silently produced jobs with `id: undefined`
 * (createJob.js) that the file adapter quarantined as malformed.
 */
export const v4 = () => {
  counter++;
  return `mock-uuid-${counter}`;
};

export default {
  v4,
  resetCounter,
};
