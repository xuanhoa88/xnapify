/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { profileSchema } from '../validator';

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

// Private symbol for translations context
const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

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
      { description: __PLUGIN_DESCRIPTION__ },
    ];
  },

  // Declarative translations — auto-registered by plugin manager before init
  translations() {
    return translationsContext;
  },

  // Lifecycle: init (called when plugin is initialized on server)
  async init(registry, context) {
    console.log(
      '[Test Plugin] Backend logic initialized for ' + __PLUGIN_NAME__,
    );

    // Get database connection
    const db = context.app.get('db');
    if (db) {
      try {
        console.log('[Test Plugin] Migration keys:', migrationsContext.keys());
        await db.connection.runMigrations([
          { context: migrationsContext, prefix: __PLUGIN_NAME__ },
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
          { context: seedsContext, prefix: __PLUGIN_NAME__ },
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

    // =========================================================================
    // IPC Handlers (accessible via POST /api/plugins/:id/ipc)
    // =========================================================================

    // Example Middleware: Logs the start and end of an IPC request
    const loggingMiddleware = async (data, ctx, next) => {
      console.log(`[Test Plugin] IPC Middleware -> Request started`, data);
      const start = Date.now();

      const result = await next(); // Proceed to the next middleware or handler

      console.log(
        `[Test Plugin] IPC Middleware -> Request ended in ${Date.now() - start}ms`,
      );
      return result;
    };

    // Example Middleware: Validates that data is provided
    const validationMiddleware = async (data, ctx, next) => {
      if (!data) {
        return { error: 'Data payload is required' };
      }
      return next();
    };

    // Example: Register an IPC handler for the 'hello' action using createPipeline
    this[HANDLERS].ipcHello = registry.createPipeline(
      loggingMiddleware,
      async data => {
        console.log('[Test Plugin] IPC hello called with:', data);
        return {
          message: `Hello from ${__PLUGIN_NAME__}!`,
          received: data,
          timestamp: new Date().toISOString(),
        };
      },
    );
    registry.registerHook(
      `ipc:${__PLUGIN_NAME__}:hello`,
      this[HANDLERS].ipcHello,
      __PLUGIN_NAME__,
    );

    // IPC handler to check if a nickname exists using createPipeline
    this[HANDLERS].ipcCheckNickname = registry.createPipeline(
      loggingMiddleware,
      validationMiddleware,
      async (data, { req }) => {
        const { nickname } = data || {};
        if (!nickname) {
          return { exists: false };
        }

        try {
          const models = context.app.get('models');
          const { UserProfile } = models;

          if (!UserProfile) {
            throw new Error('UserProfile model not found');
          }

          const existing = await UserProfile.findOne({
            where: {
              attribute_key: 'nickname',
              attribute_value: nickname,
            },
            attributes: ['user_id'],
          });

          // If the checking user is logged in, exclude their own profile
          if (existing && req && req.user && req.user.id === existing.user_id) {
            return { exists: false };
          }

          return { exists: !!existing };
        } catch (err) {
          console.error('[Test Plugin] Error checking nickname:', err);
          return { exists: false, error: err.message };
        }
      },
    );
    registry.registerHook(
      `ipc:${__PLUGIN_NAME__}:checkNickname`,
      this[HANDLERS].ipcCheckNickname,
      __PLUGIN_NAME__,
    );
  },

  // Lifecycle: destroy (called when plugin is disabled)
  async destroy(registry, context) {
    console.log('[Test Plugin] Backend logic destroyed for ' + __PLUGIN_NAME__);

    const db = context.app.get('db');
    if (db) {
      try {
        await db.connection.undoSeeds([
          { context: seedsContext, prefix: __PLUGIN_NAME__ },
        ]);
        console.log('[Test Plugin] Database seeds destroyed');
      } catch (error) {
        console.error('[Test Plugin] Database seed failed:', error.message);
      }

      try {
        console.log('[Test Plugin] Database migrations/seeds destroyed');
        await db.connection.revertMigrations([
          { context: migrationsContext, prefix: __PLUGIN_NAME__ },
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
