/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * Root Babel configuration proxy.
 * Re-exports the full config from tools/babel.config.js so that IDEs
 * and hardcoded runners automatically pick up the central settings.
 */
module.exports = require('./tools/babel.factory.js');
