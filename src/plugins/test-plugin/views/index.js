/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registerTranslations } from '../translations';
import { profileSchema } from '../validator';
import PluginField from './PluginField';

// Extract handlers for cleanup
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

const handleProfileSubmit = async (data, _context) => {
  if (data.profile.nickname) {
    console.log(`[Test Plugin] Hello, ${data.profile.nickname}!`);
  }
};

const handleProfileDefaults = async user => {
  return {
    profile: {
      nickname: (user && user.profile.nickname) || 'Anonymous User',
      birthday: (user && user.profile.birthday) || '',
    },
  };
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
  init(registry, context) {
    // 0. Register Translations
    if (context && context.i18n) {
      registerTranslations(context.i18n);
    }

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
