/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Admin index route - redirects to dashboard
 */
export function guard() {
  return { redirect: '/admin/dashboard' };
}

export default function AdminRedirect() {
  return null;
}
