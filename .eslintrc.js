/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * Root ESLint configuration proxy.
 * Re-exports the full config from tools/.eslintrc.js so that IDEs
 * and hardcoded runners automatically pick up the central settings.
 */
module.exports = require('./tools/eslint.factory.js');
