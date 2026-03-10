/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';
import { requirePermission } from '@shared/renderer/components/Rbac';
import reducer, { SLICE_NAME } from '../redux';
import Files from './Files';

// Load translations
const translationsContext = require.context(
  '../../../locales',
  false,
  /\.json$/i,
);

/**
 * Middleware hook — returns the middleware for this module.
 *
 * @returns {function} Middleware function
 */
export const middleware = requirePermission('files:read');

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
      item: {
        ns: i18n.t('admin:navigation.management', 'Management'),
        path: '/admin/files',
        label: i18n.t('files:page.title', 'Files'),
        icon: 'folder', // Assuming a folder or drive icon is available in the UI icon set
        order: 50,
      },
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
 * Init function - inject Redux slice
 */
export function init({ store }) {
  store.injectReducer(SLICE_NAME, reducer);
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
