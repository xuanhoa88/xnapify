/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { registry } from '../../../../shared/plugin';
import Form from '../../../../shared/renderer/components/Form';

const PLUGIN_ID = 'test-plugin';

// Component for the new field
const NicknameField = () => (
  <Form.Field name='nickname' label='Nickname (Plugin Field)'>
    <Form.Input type='text' placeholder='Enter your nickname' />
  </Form.Field>
);

// Schema extender function (kept as reference for cleanup)
const nicknameSchemaExtender = (schema, z) =>
  schema.extend({
    nickname: z
      .string()
      .min(3, 'Nickname must be at least 3 chars')
      .optional()
      .or(z.literal('')),
  });

// Hook callback (kept as reference for cleanup)
const submitHook = async data => {
  console.log('Plugin Hook Triggered with data:', data);
  if (data.nickname === 'admin') {
    console.warn('Nickname is admin, interesting...');
  }
};

/**
 * Register the test plugin
 */
export async function register() {
  await registry.register(PLUGIN_ID, {
    name: 'Test Plugin',

    // Called when plugin is registered
    init(reg) {
      console.log('Test Plugin Initialized');

      // Add field to UI slot
      reg.registerSlot('profile.personal_info.fields', NicknameField, {
        order: 10,
      });

      // Extend validation schema
      reg.registerSchema(
        'profile.personal_info.schema',
        nicknameSchemaExtender,
      );

      // Register hook
      reg.registerHook('profile.personal_info.submit', submitHook);
    },

    // Called when plugin is unregistered
    destroy(reg) {
      console.log('Test Plugin Destroyed');

      reg.unregisterSlot('profile.personal_info.fields', NicknameField);
      reg.unregisterSchema(
        'profile.personal_info.schema',
        nicknameSchemaExtender,
      );
      reg.unregisterHook('profile.personal_info.submit', submitHook);
    },
  });
}

/**
 * Unregister the test plugin
 */
export function unregister() {
  registry.unregister(PLUGIN_ID);
}
