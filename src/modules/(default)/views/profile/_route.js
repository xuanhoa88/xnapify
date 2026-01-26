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
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.profile', 'Profile'),
  };
}

/**
 * Guard function - require authentication
 */
export async function middleware(context, next) {
  const { store } = context;
  const state = store.getState();
  if (!isAuthenticated(state)) {
    return { redirect: `/login?next=${encodeURIComponent(context.pathname)}` };
  }
  return next();
}

/**
 * Default export - Page component
 */
export default Profile;
