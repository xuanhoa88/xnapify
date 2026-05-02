/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { getTranslations } from '@shared/i18n/loader';
import { addNamespace } from '@shared/i18n/utils';

import RoleTag from './(admin)/components/RoleTag';
import reducer, { SLICE_NAME } from './(admin)/redux';
import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.users.views__');

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
  providers({ store, container }) {
    // Merge module-specific translations into the shared 'admin' namespace
    addNamespace('admin', getTranslations(translationsContext));

    store.injectReducer(SLICE_NAME, reducer);
    container.bind(
      'users:admin:state',
      () => ({ selectors, thunks }),
      OWNER_KEY,
    );
    container.bind('users:admin:components', () => ({ RoleTag }), OWNER_KEY);
  },

  routes: () => viewsContext,
};

