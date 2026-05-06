/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { requirePermission } from '@shared/renderer/components/Rbac/index.js';
import { features } from '@shared/renderer/redux/index.js';
const { addBreadcrumb, registerMenu, unregisterMenu } = features;

import EmailTemplates from './EmailTemplates.js';

export const middleware = requirePermission('emails:templates:read');

/**
 * Register menu item for this route
 */
export function setup({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      id: 'communications',
      label: i18n.t('admin:navigation.communications', 'Communications'),
      order: 40,
      icon: 'EnvelopeClosedIcon',
      items: [
        {
          path: '/admin/emails/templates',
          label: i18n.t('admin:navigation.emailTemplates', 'Email Templates'),
          icon: 'EnvelopeOpenIcon',
          permission: 'emails:templates:read',
          order: 50,
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
      path: '/admin/emails/templates',
    }),
  );
}

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:navigation.emailTemplates', 'Email Templates'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:navigation.emailTemplates', 'Email Templates'),
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
