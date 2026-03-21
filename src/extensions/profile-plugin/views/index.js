/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { profileSchema } from '../validator';

import ExtensionField from './ExtensionField';

// Private symbol for storing composed handlers (needed for cleanup)
const HANDLERS = Symbol('handlers');

// Private symbol for translations context
const translationsContext = require.context(
  '../translations',
  false,
  /\.json$/i,
);

// =========================================================================
// Static Handlers (not middleware-composed, safe for direct ref cleanup)
// =========================================================================

const extendProfileValidator = (schema, validator) => {
  // Deep-merge the profile sub-object so we extend it, not replace it
  const extension = profileSchema(validator);
  const baseProfile = schema.shape.profile;
  const extProfile = extension.shape.profile;
  // Unwrap .optional() wrapper if present, merge, then re-wrap
  const inner = baseProfile.unwrap
    ? baseProfile.unwrap().merge(extProfile)
    : baseProfile.merge(extProfile);
  return schema.extend({ profile: inner.optional() });
};

const handleProfileDefaults = async user => {
  return {
    profile: {
      nickname: (user && user.profile.nickname) || 'anonymous-user',
      mobile: (user && user.profile.mobile) || '',
      birthdate: (user && user.profile.birthdate) || '',
    },
  };
};

// =========================================================================
// Middleware Functions (reusable across hooks)
// =========================================================================

/**
 * Logs submission timing
 */
const loggingMiddleware = (data, context, next) => {
  const start = Date.now();
  console.log('[Test Extension] Submit pipeline started', data);

  return Promise.resolve(next()).then(result => {
    console.log(
      `[Test Extension] Submit pipeline completed in ${Date.now() - start}ms`,
    );
    return result;
  });
};

/**
 * Guards against submitting when nickname is too short
 */
const nicknameGuard = (data, context, next) => {
  const nickname = data && data.profile && data.profile.nickname;
  if (nickname && nickname.length < 3) {
    console.warn(
      '[Test Extension] Nickname too short, skipping submit hook logic',
    );
    return Promise.resolve(); // Short-circuit: don't call next()
  }
  return next();
};

// Extension definition
export default {
  // Store composed handlers for cleanup
  [HANDLERS]: {},

  // Declarative translations — auto-registered by extension manager before init
  translations() {
    return translationsContext;
  },

  // Lifecycle: init (called when extension is initialized)
  init(registry, _context) {
    // 1. Register Slot Component
    registry.registerSlot('profile.personal_info.fields', ExtensionField, {
      order: 10,
    });

    // 2. Extend Schema
    registry.registerHook(
      'profile.personal_info.validator',
      extendProfileValidator,
    );

    // 3. Compose submit handler with middleware pipeline
    this[HANDLERS].profileSubmit = registry.createPipeline(
      loggingMiddleware,
      nicknameGuard,
      async data => {
        if (data.profile.nickname) {
          console.log(`[Test Extension] Hello, ${data.profile.nickname}!`);
        }
      },
    );
    registry.registerHook(
      'profile.personal_info.submit',
      this[HANDLERS].profileSubmit,
    );

    // 4. Register form defaults hook
    registry.registerHook(
      'profile.personal_info.formData',
      handleProfileDefaults,
    );
    console.log('[Test Extension] Initialized');
  },

  // Lifecycle: destroy (called when extension is disabled)
  destroy(registry) {
    registry.unregisterSlot('profile.personal_info.fields', ExtensionField);
    registry.unregisterHook(
      'profile.personal_info.validator',
      extendProfileValidator,
    );
    registry.unregisterHook(
      'profile.personal_info.submit',
      this[HANDLERS].profileSubmit,
    );
    registry.unregisterHook(
      'profile.personal_info.formData',
      handleProfileDefaults,
    );

    // Clean up handlers
    this[HANDLERS] = {};

    console.log('[Test Extension] Destroyed');
  },
};
