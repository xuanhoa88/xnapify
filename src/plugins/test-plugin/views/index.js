/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PluginField from './PluginField';
import { profileSchema } from '../validator';

// Extract handlers for cleanup
const extendProfileSchema = (schema, _validator) => {
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

  // Lifecycle: Mount (called when route is mounted)
  mount(registry) {
    // 1. Register Slot Component
    registry.registerSlot('profile.personal_info.fields', PluginField, {
      order: 10,
    });

    // 2. Extend Schema
    registry.registerValidator(
      'profile.personal_info.schema',
      extendProfileSchema,
    );

    // 3. Register Hook
    registry.registerHook('profile.personal_info.submit', handleProfileSubmit);
    registry.registerHook(
      'profile.personal_info.defaults',
      handleProfileDefaults,
    );

    console.log('[Test Plugin] Mounted');
  },

  // Lifecycle: Unmount (called when route is unmounted)
  unmount(registry) {
    registry.unregisterSlot('profile.personal_info.fields', PluginField);
    registry.unregisterValidator(
      'profile.personal_info.schema',
      extendProfileSchema,
    );
    registry.unregisterHook(
      'profile.personal_info.submit',
      handleProfileSubmit,
    );
    registry.unregisterHook(
      'profile.personal_info.defaults',
      handleProfileDefaults,
    );

    console.log('[Test Plugin] Unmounted');
  },
};
