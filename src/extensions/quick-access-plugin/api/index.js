/**
 * Quick Access Plugin — API entry point
 *
 * Plugin-kind extension that seeds demo user accounts for the
 * quick-access login widget.
 */

import { SEED_USERS } from './constants';

/** @type {Symbol} Ownership key for this extension's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.ext.quickAccess.api__');

// Auto-load contexts
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================
export default {
  /**
   * Declarative hooks — auto-processed by ServerExtensionManager.
   */
  seeds: () => seedsContext,

  /**
   * Lifecycle: providers — bind seed constants for cross-module use.
   */
  async providers({ container }) {
    container.bind('users:seed_constants', () => SEED_USERS, OWNER_KEY);
  },

  /**
   * Lifecycle: shutdown — clean up persistent bindings on extension deactivate.
   */
  async shutdown({ container }) {
    container.reset('users:seed_constants', OWNER_KEY);
  },
};
