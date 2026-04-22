/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { features } from '@shared/renderer/redux';

import * as selectors from './(admin)/redux/selector';
import * as thunks from './(admin)/redux/thunks';

const { fetchPublicSettings } = features;

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.settings.views__');

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
    container.bind(
      'settings:admin:state',
      () => ({ selectors, thunks }),
      OWNER_KEY,
    );
  },

  async boot({ store }) {
    const { settings } = store.getState();

    // Fetch public settings if they aren't populated yet by __PRELOADED_STATE__
    if (!settings || Object.keys(settings).length === 0) {
      await store.dispatch(fetchPublicSettings());
    }
  },

  routes: () => viewsContext,
  translations: () => translationsContext,
};
