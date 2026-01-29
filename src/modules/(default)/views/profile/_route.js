/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../../../shared/renderer/redux';
import {
  register as registerTestPlugin,
  unregister as unregisterTestPlugin,
} from './test-plugin';
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
 * Mount Hook - Runs when entering the route
 */
export async function mount() {
  console.log('Profile mounted');
  await registerTestPlugin();
}

/**
 * Unmount Hook - Runs when leaving the route
 */
export async function unmount() {
  console.log('Profile unmounted');
  await unregisterTestPlugin();
}

/**
 * Default export - Page component
 */
export default Profile;
