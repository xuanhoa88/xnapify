/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Find a processor matching the given job name.
 * Checks for an exact name match first, then falls back to wildcard ('*').
 *
 * @param {string} jobName - Job name to match
 * @param {Array<{name: string, handler: Function}>} processors - Registered processors
 * @returns {Object|null} Matching processor or null
 */
export function findProcessor(jobName, processors) {
  return (
    processors.find(p => p.name === jobName) ||
    processors.find(p => p.name === '*') ||
    null
  );
}
