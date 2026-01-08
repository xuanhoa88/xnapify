/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import AdminLayout from '../../components/Admin';
import { isAuthenticated, setBreadcrumbs, addBreadcrumb } from '../../redux';

// Admin base path
const ADMIN_PATH = '/admin';

// Lazy load children pages context
const pagesContext = require.context('./', true, /^\.\/[^/]+\/index\.js$/);

/**
 * Collects breadcrumbs from navigator's metadata and action result
 *
 * The navigator passes accumulated metadata from all matched views.
 * We filter this array to extract breadcrumbs from intermediate routes
 * (skipping admin itself) and combine with the child's action result breadcrumb.
 *
 * @param {Object} context - Navigation context from the admin action
 * @param {Array} metadata - Accumulated metadata from matched views
 * @param {Object} childPage - Action result from child route
 * @returns {Array} Array of breadcrumb objects {label, url}
 */
function collectBreadcrumbs(context, metadata, childPage) {
  const breadcrumbs = [];
  const { i18n } = context;

  // Collect breadcrumbs from metadata (accumulated by navigator)
  // Skip admin view (path: '/admin') since Dashboard is already set
  if (metadata && metadata.length > 0) {
    for (const entry of metadata) {
      // Skip admin view and root views
      if (
        !entry.view ||
        entry.view.path === ADMIN_PATH ||
        entry.view.path === '/'
      ) {
        continue;
      }

      // Check if this entry has a breadcrumb
      if (entry.breadcrumb) {
        const crumb = entry.breadcrumb;
        // Build URL from resolved baseUrl + path (not the route pattern)
        const url = crumb.url || entry.baseUrl + entry.path;
        breadcrumbs.push({
          url,
          label: crumb.key ? i18n.t(crumb.key, crumb.label) : crumb.label,
        });
      }
    }
  }

  // Add child's action result breadcrumb (from the action return value)
  if (childPage.breadcrumb) {
    const crumbs = Array.isArray(childPage.breadcrumb)
      ? childPage.breadcrumb
      : [childPage.breadcrumb];
    for (const crumb of crumbs) {
      breadcrumbs.push({
        label: crumb.key ? i18n.t(crumb.key, crumb.label) : crumb.label,
        url: crumb.url,
      });
    }
  }

  return breadcrumbs;
}

/**
 * Admin page factory
 * Uses async function to support dynamic page loading
 */
export default async pageBuilder => {
  const children = await pageBuilder(pagesContext);

  return {
    children,
    path: ADMIN_PATH,
    autoDelegate: false,

    /**
     * Admin route action
     * @param {Object} context - Navigation context
     * @param {Object} options - Options object
     * @param {Array} options.metadata - Accumulated metadata from matched views
     */
    async action(context, { metadata }) {
      // Auth check
      const state = context.store.getState();
      if (!isAuthenticated(state)) {
        return { redirect: '/login' };
      }

      // Initialize admin breadcrumb namespace with Dashboard
      context.store.dispatch(
        setBreadcrumbs({
          admin: {
            label: context.i18n.t('navigation.dashboard', 'Dashboard'),
            url: ADMIN_PATH,
          },
        }),
      );

      // Delegate to child routes
      const childPage = await context.next();
      if (!childPage || !childPage.component) {
        return { redirect: '/not-found' };
      }

      // Collect and dispatch breadcrumbs from metadata and action result
      const breadcrumbs = collectBreadcrumbs(context, metadata, childPage);
      for (const crumb of breadcrumbs) {
        context.store.dispatch(addBreadcrumb(crumb, 'admin'));
      }

      // Get title from action result
      const title =
        childPage.title || context.i18n.t('navigation.admin', 'Admin Panel');

      return {
        ...childPage,
        title,
        component: <AdminLayout>{childPage.component}</AdminLayout>,
      };
    },
  };
};
