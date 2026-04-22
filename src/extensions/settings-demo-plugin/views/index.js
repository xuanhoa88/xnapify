// Private symbol for handlers
const HANDLERS = Symbol('handlers');

export default {
  [HANDLERS]: {},

  boot({ registry }) {
    // Inject custom settings tab configuration metadata
    registry.registerHook('settings.tabs.config', () => ({
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
    }));

    console.log(`[Extension] Initialized frontend for ${__EXTENSION_ID__}`);
  },

  shutdown({ registry }) {
    registry.unregisterHook('settings.tabs.config');
    this[HANDLERS] = {};
    console.log(`[Extension] Destroyed frontend for ${__EXTENSION_ID__}`);
  },
};
