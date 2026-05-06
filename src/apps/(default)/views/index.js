/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Auto-load contexts
const viewsContext = import.meta.webpackContext('.', {
  recursive: true,
  regExp:
    /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
});
const translationsContext = import.meta.webpackContext('../translations', {
  recursive: false,
  regExp: /\.json$/i,
});

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  translations() {
    return [translationsContext, 'translation'];
  },
  providers() {
    // The (default) module owns keys like login.*, register.*, profile.*, navigation.*
    // that components access via bare useTranslation() calls.
  },
  routes: () => viewsContext,
};
