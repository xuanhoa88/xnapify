/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';

import reducer, { SLICE_NAME } from '../redux';

import Files from './Files';

// Load translations
const translationsContext = require.context(
  '../../../translations',
  false,
  /\.json$/i,
);

export const middleware = requirePermission('files:read');

/**
 * Route boot — inject Redux reducer into the store.
 */
export function boot({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
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
 * Register menu item for this route
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'content',
      label: i18n.t('admin:navigation.content', 'Content'),
      order: 20,
      icon: 'folder',
      items: [
        {
          path: '/admin/files',
          label: i18n.t('files:page.title', 'Files'),
          icon: 'folder',
          permission: 'files:read',
          order: 50,
        },
      ],
    }),
  );
}

/**
 * Unregister menu item for this route
 */
export function unregister({ store }) {
  store.dispatch(
    unregisterMenu({
      ns: 'admin',
      path: '/admin/files',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('files:page.title', 'Files'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      { label: i18n.t('files:page.title', 'Files'), url: path },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default Files;
