/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */
// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

import { profileSchema } from '../validator';

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
  init(context) {
    console.log(
      '[Test Plugin] Backend logic initialized for ' + __PLUGIN_NAME__,
    );

    // Get hook engine from app
    const hook = context.app.get('hook');

    // Handler to extend profile schema
    this[HANDLERS].updateValidation = function (context) {
      if (context.schema) {
        const extension = profileSchema();
        context.schema = context.schema.merge(extension);
        console.log('[Test Plugin] Extended profile schema via hook');
      }
    };
    hook('profile').on('validation:update', this[HANDLERS].updateValidation);

    // Handler to intercept profile update and save nickname to preferences
    this[HANDLERS].updating = function (data) {
      const { formData, user } = data;

      // If nickname is provided, move it to preferences
      if (formData && 'nickname' in formData) {
        const { nickname } = formData;
        delete formData.nickname; // Remove from top-level

        // Get existing preferences from the user's profile
        const existingPreferences =
          (user && user.profile && user.profile.preferences) || {};

        // Merge nickname into existing preferences
        formData.preferences = {
          ...existingPreferences,
          ...(formData.preferences || {}),
          nickname,
        };
        console.log('[Test Plugin] Saved nickname to preferences:', nickname);
      }
    };
    hook('profile').on('updating', this[HANDLERS].updating);

    // Handler to read nickname from preferences and add to response
    this[HANDLERS].formatResponse = function (data) {
      const { user, profile, result } = data;

      // Read nickname from preferences JSON field
      let nickname = null;
      if (profile) {
        const preferences = profile.preferences || {};
        nickname = preferences.nickname || null;
      }

      // Set default nickname from email if not present
      if (!nickname && user && user.email) {
        nickname = user.email.split('@')[0];
      }

      result.nickname = nickname || null;
      console.log(
        '[Test Plugin] Added nickname to response: ' + result.nickname,
      );
    };

    // Register hook for user response formatting
    hook('profile').on('formatResponse', this[HANDLERS].formatResponse);
  },

  // Lifecycle: destroy (called when plugin is disabled)
  destroy(context) {
    console.log('[Test Plugin] Backend logic destroyed for ' + __PLUGIN_NAME__);

    // Unsubscribe from hooks
    const hook = context.app.get('hook');
    if (this[HANDLERS].updateValidation) {
      hook('profile').off('validation:update', this[HANDLERS].updateValidation);
    }
    if (this[HANDLERS].updating) {
      hook('profile').off('updating', this[HANDLERS].updating);
    }
    if (this[HANDLERS].formatResponse) {
      hook('profile').off('formatResponse', this[HANDLERS].formatResponse);
    }

    // Clear handlers
    this[HANDLERS] = {};
  },
};
