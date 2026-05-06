/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';
import Hub from './Hub';
import { resetHubState } from './redux';
const {
  addBreadcrumb
} = features;

// Load translations
const translationsContext = import.meta.webpackContext('../../../translations', {
  recursive: false,
  regExp: /\.json$/i
});
export const middleware = requirePermission('extensions:read');

/**
 * Unmount — clean up Redux state when leaving the hub page.
 */
export function unmount({
  store
}) {
  store.dispatch(resetHubState());
}

/**
 * Translations hook — returns the webpack require.context for this module's translations.
 *
 * @returns {object} Webpack require.context for translations
 */
export function translations() {
  return translationsContext;
}

/**
 * Page metadata
 */
export async function getInitialProps({
  i18n
}) {
  return {
    title: i18n.t('admin:navigation.hub', 'Extension Hub')
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({
  store,
  i18n,
  path
}) {
  store.dispatch(addBreadcrumb({
    label: i18n.t('admin:navigation.hub', 'Extension Hub'),
    url: path
  }, 'admin'));
}

/**
 * Default export - Page component
 */
export default Hub;