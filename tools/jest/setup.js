/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Jest setup file (setupFiles phase — runs before test environment).
 *
 * Define build-time globals that Webpack's DefinePlugin normally injects.
 * The `globals` key in jest.config only works reliably with the default
 * test environment; per-file @jest-environment overrides can lose them.
 * Defining them here guarantees availability in every test suite.
 */
// eslint-disable-next-line no-underscore-dangle
global.__DEV__ = false;
// eslint-disable-next-line no-underscore-dangle
global.__TEST__ = true;

// Increase MaxListeners to accommodate gracefully shutting down all backend engines during testing
process.setMaxListeners(20);
