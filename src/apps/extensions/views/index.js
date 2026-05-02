/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace } from '@shared/i18n/utils';

import hubReducer, { SLICE_NAME as HUB_SLICE } from './(admin)/hub/redux';

// Auto-load contexts
const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout|\(routes\)\/\([^)]+\)|\(layouts\)\/\([^)]+\)\/_layout)\.[cm]?[jt]sx?$/i,
);

const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  providers({ store }) {
    // Merge module-specific translations into the shared 'admin' namespace
    addNamespace('admin', getTranslations(translationsContext));

    store.injectReducer(HUB_SLICE, hubReducer);
  },
  routes: () => viewsContext,
};
