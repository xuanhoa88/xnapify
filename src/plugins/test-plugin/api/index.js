/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerTranslations } from '../translations';
import { profileSchema } from '../validator';

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

// Private symbol for migrations context
const migrationsContext = require.context(
  './database/migrations',
  false,
  /\.[cm]?[jt]s$/i,
);

// Private symbol for seeds context
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

// Plugin definition for backend
export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  // Metadata & registration config
  register() {
    return [
      ['profile', 'dashboard'],
      __PLUGIN_NAME__,
      { name: __PLUGIN_DESCRIPTION__ },
    ];
  },

  // Lifecycle: init (called when plugin is initialized on server)
  async init(registry, context) {
    console.log(
      '[Test Plugin] Backend logic initialized for ' + __PLUGIN_NAME__,
    );

    // 0. Register Translations
    if (context.i18n) {
      registerTranslations(context.i18n);
    }

    // Get database connection
    const db = context.app.get('db');
    if (db) {
      try {
        console.log('[Test Plugin] Migration keys:', migrationsContext.keys());
        await db.connection.runMigrations([
          { context: migrationsContext, prefix: 'test-plugin' },
        ]);
        console.log('[Test Plugin] Database migrations executed');
      } catch (error) {
        console.error(
          '[Test Plugin] Database migration failed:',
          error.message,
        );
      }

      try {
        console.log('[Test Plugin] Seed keys:', seedsContext.keys());
        await db.connection.runSeeds([
          { context: seedsContext, prefix: 'test-plugin' },
        ]);
        console.log('[Test Plugin] Database seeds executed');
      } catch (error) {
        console.error('[Test Plugin] Database seed failed:', error.message);
      }
    }

    // Get hook engine
    const hook = context.app.get('hook');

    // Handler to extend profile schema
    this[HANDLERS].updateValidation = function (context) {
      if (context.schema) {
        const extension = profileSchema(context.z);
        // Deep-merge the profile sub-object so we extend it, not replace it
        const baseProfile = context.schema.shape.profile;
        const extProfile = extension.shape.profile;
        // Unwrap .optional() wrapper if present, merge, then re-wrap
        const inner = baseProfile.unwrap
          ? baseProfile.unwrap().merge(extProfile)
          : baseProfile.merge(extProfile);
        context.schema = context.schema.extend({
          profile: inner.optional(),
        });
        console.log('[Test Plugin] Extended profile schema via hook');
      }
    };
    hook('profile').on('validation:update', this[HANDLERS].updateValidation);

    // The updating hook is no longer needed!
    // formData.nickname and formData.birthday are automatically persisted
    // as native EAV rows by the core profile service.
    this[HANDLERS].updating = function (profileData) {
      if (profileData && profileData.nickname) {
        console.log(
          '[Test Plugin] Persisting nickname as native EAV row:',
          profileData.nickname,
        );
      }
    };
    hook('profile').on('updating', this[HANDLERS].updating);

    // Handler to read nickname + birthday from profile EAV and add to response
    this[HANDLERS].formatResponse = function (user) {
      // Ensure profile exists in result
      user.profile = user.profile || {};

      // Read nickname from native profile EAV row
      let nickname = user.profile.nickname || null;
      if (!nickname && user.email) {
        nickname = user.email.split('@')[0];
      }
      user.profile.nickname = nickname || null;

      // Read birthday from native profile EAV row
      user.profile.birthday = user.profile.birthday || null;

      console.log(
        '[Test Plugin] Added nickname to response: ' + user.profile.nickname,
      );
    };

    // Register hook for user response formatting
    hook('profile').on('retrieved', this[HANDLERS].formatResponse);
  },

  // Lifecycle: destroy (called when plugin is disabled)
  async destroy(registry, context) {
    console.log('[Test Plugin] Backend logic destroyed for ' + __PLUGIN_NAME__);

    const db = context.app.get('db');
    if (db) {
      try {
        await db.connection.undoSeeds([
          { context: seedsContext, prefix: 'test-plugin' },
        ]);
        console.log('[Test Plugin] Database seeds destroyed');
      } catch (error) {
        console.error('[Test Plugin] Database seed failed:', error.message);
      }

      try {
        console.log('[Test Plugin] Database migrations/seeds destroyed');
        await db.connection.revertMigrations([
          { context: migrationsContext, prefix: 'test-plugin' },
        ]);
        console.log('[Test Plugin] Database migrations destroyed');
      } catch (error) {
        console.error(
          '[Test Plugin] Database migration failed:',
          error.message,
        );
      }
    }

    // Unsubscribe from hooks
    const hook = context.app.get('hook');
    if (this[HANDLERS].updateValidation) {
      hook('profile').off('validation:update', this[HANDLERS].updateValidation);
    }
    if (this[HANDLERS].updating) {
      hook('profile').off('updating', this[HANDLERS].updating);
    }
    if (this[HANDLERS].formatResponse) {
      hook('profile').off('retrieved', this[HANDLERS].formatResponse);
    }

    // Clear handlers
    this[HANDLERS] = {};
  },
};
