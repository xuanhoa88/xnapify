/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';

import reducer, { SLICE_NAME } from '../redux';

import Files from './Files';

const { addBreadcrumb, registerMenu, unregisterMenu } = features;

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
export function init({ store }) {
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
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'content',
      label: i18n.t('admin:navigation.content', 'Content'),
      order: 20,
      icon: 'FileTextIcon',
      items: [
        {
          path: '/admin/files',
          label: i18n.t('admin:navigation.files', 'Files'),
          icon: 'FileTextIcon',
          permission: 'files:read',
          order: 10,
        },
      ],
    }),
  );
}

/**
 * Unregister menu item for this route
 */
export function teardown({ store }) {
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
