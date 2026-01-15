/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import AdminLayout from '../../components/Admin';
import { isAuthenticated, setBreadcrumbs, addBreadcrumb } from '../../redux';

// Auto-load admin pages via require.context
const pagesContext = require.context(
  './',
  true,
  /^\.\/[^/]+\/index\.(jsx?|tsx?)$/,
);

/**
 * Collects breadcrumbs from navigator's metadata and action result
 *
 * The navigator passes accumulated metadata from all matched views.
 * We filter this array to extract breadcrumbs from intermediate routes
 * (skipping admin itself) and combine with the child's action result breadcrumb.
 *
 * @param {Object} i18n - I18n instance from the admin action
 * @param {Array} metadata - Accumulated metadata from matched views
 * @param {Object} childPage - Action result from child route
 * @returns {Array} Array of breadcrumb objects {label, url}
 */
function collectBreadcrumbs(i18n, metadata, childPage) {
  // Normalize childPage breadcrumb to array format
  const childBreadcrumbs = childPage.breadcrumb
    ? [].concat(childPage.breadcrumb).map(crumb => ({ breadcrumb: crumb }))
    : [];

  // Combine metadata entries with child breadcrumbs (without mutating metadata)
  const allEntries = [...metadata, ...childBreadcrumbs];

  // Build breadcrumb objects from all entries
  return allEntries.reduce((breadcrumbs, entry) => {
    if (!entry.breadcrumb) {
      return breadcrumbs;
    }

    const crumb = entry.breadcrumb;

    // Build URL: prefer explicit url, fallback to resolved path, or undefined
    let { url } = crumb;
    if (!url && entry.baseUrl && entry.path) {
      url = entry.baseUrl + entry.path;
    }

    // Build label: translate if key provided, otherwise use label directly
    const label = crumb.key ? i18n.t(crumb.key, crumb.label) : crumb.label;

    breadcrumbs.push({ url, label });
    return breadcrumbs;
  }, []);
}

/**
 * Admin page factory
 * Uses async function to support dynamic page loading
 */
export default async pageBuilder => {
  const children = await pageBuilder(pagesContext);

  return {
    children,
    path: '/admin',
    autoResolve: false,
    boot({ store, i18n, path }) {
      // Set breadcrumbs for admin namespace
      store.dispatch(
        setBreadcrumbs({
          admin: {
            label: i18n.t('navigation.dashboard', 'Dashboard'),
            url: path,
          },
        }),
      );
    },
    async action({ store, i18n, next }, { metadata }) {
      // Auth check
      const state = store.getState();
      if (!isAuthenticated(state)) {
        return { redirect: '/login' };
      }

      // Delegate to child routes
      const childPage = await next();
      if (!childPage || !childPage.component) {
        return { redirect: '/not-found' };
      }

      // Collect and dispatch breadcrumbs from metadata and action result
      const breadcrumbs = collectBreadcrumbs(i18n, metadata, childPage);
      for (const crumb of breadcrumbs) {
        store.dispatch(addBreadcrumb(crumb, 'admin'));
      }

      // Get title from action result
      const title =
        childPage.title || i18n.t('navigation.admin', 'Admin Panel');

      return {
        ...childPage,
        title,
        component: <AdminLayout>{childPage.component}</AdminLayout>,
      };
    },
  };
};
