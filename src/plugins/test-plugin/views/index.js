/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { addNamespace } from '../../../shared/i18n/addNamespace';
import { getTranslations } from '../../../shared/i18n/getTranslations';
import { profileSchema } from '../validator';
import { PLUGIN_ID } from '../constants';
import PluginField from './PluginField';

// Register translations for this plugin (client-side)
addNamespace(
  PLUGIN_ID,
  getTranslations(require.context('../translations', false, /\.json$/i)),
);

// Extract handlers for cleanup
const extendProfileValidator = (schema, _validator) => {
  // Merge plugin schema with base schema
  // We use the exported profileSchema which uses the shared Zod instance
  const extension = profileSchema();
  return schema.merge(extension);
};

const handleProfileSubmit = async (data, _context) => {
  if (data.nickname) {
    console.log(`[Test Plugin] Hello, ${data.nickname}!`);
  }
};

const handleProfileDefaults = async user => {
  if (!user || !user.nickname) {
    return {
      nickname: 'Anonymous User',
    };
  }
  return {};
};

// Plugin definition
export default {
  // Metadata & registration config
  register() {
    return [
      ['profile', 'dashboard'],
      __PLUGIN_NAME__,
      { name: __PLUGIN_DESCRIPTION__ },
    ];
  },

  // Lifecycle: init (called when plugin is initialized)
  init(registry) {
    // 1. Register Slot Component
    registry.registerSlot('profile.personal_info.fields', PluginField, {
      order: 10,
    });

    // 2. Extend Schema
    registry.registerHook(
      'profile.personal_info.validator',
      extendProfileValidator,
    );

    // 3. Register Hook
    registry.registerHook('profile.personal_info.submit', handleProfileSubmit);
    registry.registerHook(
      'profile.personal_info.formData',
      handleProfileDefaults,
    );

    console.log('[Test Plugin] Initialized');
  },

  // Lifecycle: destroy (called when plugin is disabled)
  destroy(registry) {
    registry.unregisterSlot('profile.personal_info.fields', PluginField);
    registry.unregisterHook(
      'profile.personal_info.validator',
      extendProfileValidator,
    );
    registry.unregisterHook(
      'profile.personal_info.submit',
      handleProfileSubmit,
    );
    registry.unregisterHook(
      'profile.personal_info.formData',
      handleProfileDefaults,
    );

    console.log('[Test Plugin] Destroyed');
  },
};
