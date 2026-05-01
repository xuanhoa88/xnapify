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

export const v4 = jest.fn(() => {
  counter++;
  return `mock-uuid-${counter}`;
});

export default {
  v4,
  resetCounter,
};
