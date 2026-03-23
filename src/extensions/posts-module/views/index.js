/**
 * Posts Module — View entry point
 *
 * Module-type extension that provides view routes via the views() hook
 * and injects its Redux reducer into the store.
 */

import reducer, { SLICE_NAME } from './(admin)/redux';

const viewsContext = require.context(
  '.',
  true,
  /(?:\/_route|\/_layout)\.[cm]?[jt]sx?$/i,
);

const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

export default {
  init(_registry, _context, { store } = {}) {
    if (store) {
      store.injectReducer(SLICE_NAME, reducer);
    }
  },

  destroy(_registry) {
    // no-op
  },

  /**
   * Declarative translations — auto-registered by extension manager.
   */
  translations() {
    return translationsContext;
  },

  /**
   * Module-type hook: provides view routes for dynamic injection.
   * Returns [moduleName, context] — the framework auto-builds the adapter.
   */
  views() {
    return ['posts', viewsContext];
  },
};
