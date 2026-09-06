/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as authController from './controllers/auth.controller.js';
import * as profileController from './controllers/profile.controller.js';
import * as sessionService from './services/session.service.js';
import { authenticate as handleApiKeyStrategy } from './utils/apiKey/index.js';
import * as rbacCache from './utils/rbac/cache.js';
import { getUserRbacData } from './utils/rbac/fetcher.js';
import { registerSearchHooks } from './workers/index.js';

/** @type {Symbol} Ownership key for this module's persistent bindings */
const OWNER_KEY = Symbol('__xnapify.module.users.api__');

// Auto-load contexts
const migrationsContext = import.meta.webpackContext('./database/migrations', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const modelsContext = import.meta.webpackContext('./models', {
  recursive: false,
  regExp: /\.[cm]?[jt]s$/i,
});
const routesContext = import.meta.webpackContext('./routes', {
  recursive: true,
  regExp: /\.[cm]?[jt]s$/i,
});

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Register auth strategies and RBAC hook listeners.
 *
 * @param {Object} container - DI container instance
 */
async function registerAuthHooks(container) {
  const hook = container.resolve('hook');
  hook('auth.strategy.api_key').on('authenticate', handleApiKeyStrategy);
  hook('auth.permissions').on('resolve', getUserRbacData);
  hook('auth.roles').on('resolve', getUserRbacData);
  hook('auth.groups').on('resolve', getUserRbacData);
  hook('auth.ownership').on('resolve', getUserRbacData);

  // Session rotation contract used by the shared auth middleware and SSR.
  // The caller passes { refreshToken, meta } and reads back ctx.tokens.
  hook('auth.session').on('rotate', async ctx => {
    ctx.tokens = await sessionService.rotateTokenPair(ctx.refreshToken, {
      jwt: container.resolve('jwt'),
      models: container.resolve('models'),
      meta: ctx.meta,
    });
  });
}

/**
 * Register the session-revocation listeners that other flows emit.
 */
function registerSessionRevocation(container) {
  const hook = container.resolve('hook');
  const deps = () => ({
    models: container.resolve('models'),
    // Close live WebSocket connections of the revoked sessions
    ws: container.has('ws') ? container.resolve('ws') : null,
  });

  // Password changed via profile → every OTHER session must re-authenticate.
  // `family_id` is the session that performed the change: revoking it too
  // would bounce the user to the login screen on their next click, right
  // after the controller told them the change succeeded.
  hook('profile').on('password_changed', async ({ user_id, family_id }) => {
    await sessionService.revokeUserSessions(user_id, {
      ...deps(),
      exceptFamilyId: family_id || null,
    });
  });
  // Password reset via email token → all sessions
  hook('auth').on('password_reset_completed', async ({ user_id }) => {
    await sessionService.revokeUserSessions(user_id, deps());
  });
  // Admin password reset → all sessions of that user
  hook('admin:users').on('password_reset', async ({ user_id }) => {
    if (user_id) await sessionService.revokeUserSessions(user_id, deps());
  });
  // Admin edit that deactivates the account
  hook('admin:users').on('updated', async ({ user_id, user }) => {
    if (user && user.is_active === false) {
      await sessionService.revokeUserSessions(user_id, deps());
    }
  });
  // Bulk (de)activation
  hook('admin:users').on('status_updated', async ({ user, is_active }) => {
    if (!is_active && user && user.id) {
      await sessionService.revokeUserSessions(user.id, deps());
    }
  });
  // Deletion (admin bulk delete and self-service account deletion)
  hook('admin:users').on('deleted', async ({ user_id }) => {
    if (user_id) await sessionService.revokeUserSessions(user_id, deps());
  });
  hook('profile').on('account_deleted', async ({ user_id }) => {
    if (user_id) await sessionService.revokeUserSessions(user_id, deps());
  });
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export default {
  migrations: () => migrationsContext,
  models: () => modelsContext,
  routes: () => routesContext,
  async providers({ container }) {
    container.bind(
      'users:controllers',
      () => ({
        profile: profileController,
        auth: authController,
      }),
      OWNER_KEY,
    );
    container.bind('users:rbacCache', () => rbacCache, OWNER_KEY);
    container.bind('users:sessions', () => sessionService, OWNER_KEY);
    await registerAuthHooks(container);
    registerSessionRevocation(container);
    registerSearchHooks(container);
  },
  async boot({ container }) {
    const schedule = container.resolve('schedule');
    // Nightly cleanup of expired / long-revoked refresh tokens
    schedule.register('users:purge-refresh-tokens', '15 3 * * *', async () => {
      try {
        const removed = await sessionService.purgeExpired({
          models: container.resolve('models'),
        });
        if (removed > 0) {
          console.info(`[Users] Purged ${removed} stale refresh token(s)`);
        }
      } catch (err) {
        console.error('[Users] Refresh token purge failed:', err.message);
      }
    });
  },
};
