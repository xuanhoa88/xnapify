/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Private symbol for handlers
const HANDLERS = Symbol('handlers');

export default {
  [HANDLERS]: {},

  boot({ registry }) {
    // Keep the callback reference: hooks are removed by identity, so an
    // inline arrow registered here could never be unregistered later.
    this[HANDLERS].tabConfig = () => ({
      demo_ext: {
        icon: 'StarIcon',
        label: 'Demo Config', // Fallback label
        i18nKey: 'admin:extensions.demoSettings.title',
        order: 90, // Place it towards the end but before 'system'
        fieldOrder: [
          'DEMO_FEATURE_ENABLED',
          'DEMO_GREETING_MESSAGE',
          'DEMO_RETRY_COUNT',
        ],
      },
    });
    registry.registerHook('settings.tabs.config', this[HANDLERS].tabConfig);

    console.log(`[Extension] Initialized frontend for ${__EXTENSION_ID__}`);
  },

  shutdown({ registry }) {
    registry.unregisterHook('settings.tabs.config', this[HANDLERS].tabConfig);
    this[HANDLERS] = {};
    console.log(`[Extension] Destroyed frontend for ${__EXTENSION_ID__}`);
  },
};
