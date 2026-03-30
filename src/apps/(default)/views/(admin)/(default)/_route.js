/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Admin index route - redirects to activities
 */
export function middleware() {
  return { redirect: '/admin/activities' };
}
