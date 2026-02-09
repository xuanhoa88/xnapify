/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */
import { PLUGIN_ID } from '../constants';

// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

import { profileSchema } from '../validator';

// Plugin definition for backend
export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  // Metadata & registration config
  register() {
    return ['profile', PLUGIN_ID, { name: 'Test Plugin (Backend)' }];
  },

  // Lifecycle: Mount (called when plugin is initialized on server)
  mount(context) {
    console.log('[Test Plugin] Backend logic initialized for ' + PLUGIN_ID);

    // Get hook engine from app
    const hook = context.app.get('hook');

    // Handler to extend profile schema
    this[HANDLERS].extendSchema = function (context) {
      if (context.schema) {
        const extension = profileSchema();
        context.schema = context.schema.merge(extension);
        console.log('[Test Plugin] Extended profile schema via hook');
      }
    };
    hook('profile').on('extendSchema', this[HANDLERS].extendSchema);

    // Store handler reference for cleanup
    // This handler extends the user response with a nickname field
    this[HANDLERS].formatResponse = function (data) {
      const { user, profile, result } = data;

      // Add nickname to the response object
      // This is the extensible pattern - plugins can add any custom fields
      let nickname = null;
      if (profile) {
        if (typeof profile.getDataValue === 'function') {
          nickname = profile.getDataValue('nickname');
        }
        if (!nickname) {
          nickname = profile.nickname;
        }
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

  // Lifecycle: Unmount (called when plugin is disabled)
  unmount(context) {
    console.log('[Test Plugin] Backend logic unmounted for ' + PLUGIN_ID);

    // Unsubscribe from hooks
    const hook = context.app.get('hook');
    if (this[HANDLERS].extendSchema) {
      hook('profile').off('extendSchema', this[HANDLERS].extendSchema);
    }
    if (this[HANDLERS].formatResponse) {
      hook('profile').off('formatResponse', this[HANDLERS].formatResponse);
    }

    // Clear handlers
    this[HANDLERS] = {};
  },
};
