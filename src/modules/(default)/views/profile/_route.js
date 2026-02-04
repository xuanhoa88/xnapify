/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isAuthenticated } from '../../../../shared/renderer/redux';
import Profile from './Profile';

import { bindPluginNamespace } from '../../../../shared/plugin';

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
    return { redirect: `/login?next=${encodeURIComponent(pathname)}` };
  }
  return next();
}

/**
 * Plugin Namespace to load
 */
export const pluginNamespace = 'profile';

/**
 * Init Hook - Bind plugins
 */
export async function init(ctx) {
  bindPluginNamespace(pluginNamespace, ctx);
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
