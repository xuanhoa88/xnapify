/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace } from '@shared/i18n/utils';

import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.permissions.views__');

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
  providers({ container }) {
    // Merge module-specific translations into the shared 'admin' namespace
    addNamespace('admin', getTranslations(translationsContext));

    container.bind(
      'permissions:admin:state',
      () => ({ selectors, thunks }),
      OWNER_KEY,
    );
  },

  routes: () => viewsContext,
};
