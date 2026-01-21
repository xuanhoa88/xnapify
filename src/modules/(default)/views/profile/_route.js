/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../../../shared/renderer/redux';
import Profile from './Profile';

/**
 * Page metadata
 */
export const metadata = {
  title: 'Profile',
};

/**
 * Guard function - require authentication
 */
export async function guard(context) {
  const state = context.store.getState();

  if (!isAuthenticated(state)) {
    return { redirect: '/login' };
  }
}

/**
 * Default export - Page component
 */
export default Profile;
