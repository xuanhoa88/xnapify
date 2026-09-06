/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Jest setup file (setupFiles phase — runs inside the VM sandbox).
 *
 * Defines build-time globals that Webpack's DefinePlugin normally injects.
 * The `globals` key in jest.config only works reliably with the default
 * test environment; per-file @jest-environment overrides can lose them.
 * Defining them here guarantees availability in every test suite.
 */

import requireContextPolyfill from './requireContextPolyfill.js';

// Inject context polyfill for the SWC transformer to consume
// eslint-disable-next-line no-underscore-dangle
globalThis.__webpack_require_context__ = requireContextPolyfill;

// eslint-disable-next-line no-underscore-dangle
globalThis.__DEV__ = false;

// eslint-disable-next-line no-underscore-dangle
globalThis.__TEST__ = true;

// Host version for the extension compatibility contract
// eslint-disable-next-line no-underscore-dangle
globalThis.__XNAPIFY_VERSION__ = process.env.npm_package_version || '2.0.0';

// Extensions bundled with the host build, which the capability contract
// trusts with the privileged tier. Nothing is bundled into a test run, so the
// default is empty and a suite that needs a bundled extension assigns its own.
// eslint-disable-next-line no-underscore-dangle
globalThis.__XNAPIFY_BUNDLED_EXTENSIONS__ = [];

// Increase MaxListeners to accommodate gracefully shutting down all backend engines during testing
process.setMaxListeners(20);
