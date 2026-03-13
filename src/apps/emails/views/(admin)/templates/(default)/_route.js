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

import EmailTemplates from './EmailTemplates';

export const middleware = requirePermission('emails:templates:update');

/**
 * Register menu item for this route
 */
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      item: {
        ns: i18n.t('admin:navigation.emails', 'Emails'),
        path: '/admin/emails',
        label: i18n.t('admin:emails.templates', 'Templates'),
        icon: 'mail',
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
      path: '/admin/emails',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:emails.templates', 'Templates'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:emails.templates', 'Templates'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default EmailTemplates;
