/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import { addBreadcrumb } from '@shared/renderer/redux';

import Hub from './Hub';
import hubReducer, { SLICE_NAME as HUB_SLICE_NAME } from './redux';

// Load translations
const translationsContext = require.context(
  '../../../translations',
  false,
  /\.json$/i,
);

export const middleware = requirePermission('extensions:read');

/**
 * Route boot — inject Redux reducer into the store.
 */
export function boot({ store }) {
  store.injectReducer(HUB_SLICE_NAME, hubReducer);
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
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.hub', 'Extension Hub'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.hub', 'Extension Hub'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Hub;
