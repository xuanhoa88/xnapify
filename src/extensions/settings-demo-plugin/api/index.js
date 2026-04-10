// Private symbol for handlers storage
const HANDLERS = Symbol('handlers');

// Load seeds context
const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

export default {
  // Store handlers for cleanup
  [HANDLERS]: {},

  seeds() {
    return seedsContext;
  },

  async boot({ container }) {
    console.log(`[Extension] Initialized backend for ${__EXTENSION_ID__}`);
  },

  async shutdown({ container }) {
    // Clear handlers
    this[HANDLERS] = {};
    console.log(`[Extension] Destroyed backend for ${__EXTENSION_ID__}`);
  },
};
