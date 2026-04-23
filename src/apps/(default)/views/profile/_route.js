/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux';

import Profile from './Profile';

const { isAuthenticated } = features;

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
export async function middleware({ store, pathname }, next) {
  const state = store.getState();
  if (!isAuthenticated(state)) {
    return { redirect: `/login?returnTo=${encodeURIComponent(pathname)}` };
  }
  return next();
}

/**
 * Mount Hook - Runs when entering the route
 */
export async function mount() {
  console.log('Profile mounted');
}

/**
 * Unmount Hook - Runs when leaving the route
 */
export async function unmount() {
  console.log('Profile unmounted');
}

/**
 * Default export - Page component
 */
export default Profile;
