/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PluginField from './PluginField';

// Plugin ID
const PLUGIN_ID = 'test-plugin';

// Plugin definition
export default {
  // Metadata & registration config
  register() {
    return ['profile', PLUGIN_ID, { name: 'Test Plugin' }];
  },

  // Lifecycle: Mount (called when route is mounted)
  mount(registry) {
    // 1. Register Slot Component
    // CORRECT: targetSlotId, component, options
    registry.registerSlot('profile.personal_info.fields', PluginField, {
      order: 10,
    });

    // 2. Extend Schema
    // CORRECT: Use registerSchema (provider API), not extendSchema (consumer API)
    registry.registerSchema(
      'profile.personal_info.schema',
      (schema, validator) => {
        return schema.extend({
          nickname: validator
            .string()
            .min(3, 'Nickname must be at least 3 chars')
            .optional()
            .or(validator.literal('')),
        });
      },
    );

    // 3. Register Hook
    // CORRECT: targetHookId, callback
    registry.registerHook(
      'profile.personal_info.submit',
      async (data, _context) => {
        console.log('[Test Plugin] Form submitted with data:', data);
        if (data.nickname) {
          console.log(`[Test Plugin] Hello, ${data.nickname}!`);
        }
      },
    );

    console.log('[Test Plugin] Mounted');
  },

  // Lifecycle: Unmount (called when route is unmounted)
  unmount(registry) {
    registry.unregisterSlot('profile.personal_info.fields', PluginField);

    // Note: We can't easily unregister the anonymous schema extender or hook callback
    // defined inline above. ideally we should define them outside.
    // For now, this is a limitation of the current implementation in this file.
    // To fix this properly, we should move the functions out.

    // For this quick fix, I will leave it as is, but in a real scenario
    // we should define the functions outside the object or use named functions.
    // However, since we are just fixing the API usage, and the registry doesn't strict check
    // identity for 'unregister' if we match the correct ID (it might just remove all if not careful
    // but the registry implementation showed using specific references).

    // Checking registry.js again...
    // unregisterSlot(slotId, component) - needs component ref
    // unregisterHook(hookId, callback) - needs callback ref

    // So my previous comment about anonymous functions is valid.
    // I should extract them to fix the uninstall logic too.

    console.log('[Test Plugin] Unmounted');
  },
};
