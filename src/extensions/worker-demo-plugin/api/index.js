/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Demo Plugin — Backend Extension
 *
 * Demonstrates worker functions by:
 * - Creating a worker API with text + math utility functions
 * - Exposing worker tasks via IPC endpoints
 * - Properly cleaning up on shutdown
 */

import { createDemoWorkers } from './workers';

// Private symbol for handler storage (cleanup symmetry)
const HANDLERS = Symbol('handlers');

// Private symbol for workers reference
const WORKERS = Symbol('workers');

// Maximum limits for IPC safety
const MAX_FIBONACCI_N = 10_000;
const MAX_SIEVE_LIMIT = 1_000_000;
const MAX_TEXT_LENGTH = 100_000;

export default {
  [HANDLERS]: {},
  [WORKERS]: null,

  async boot({ registry }) {
    console.log(`[${__EXTENSION_ID__}] Booting worker demo extension`);

    // Create the workers lazily — NOT at module load time
    let workers;
    try {
      workers = createDemoWorkers();
      this[WORKERS] = workers;
      console.log(`[${__EXTENSION_ID__}] Workers created`);
    } catch (err) {
      console.error(
        `[${__EXTENSION_ID__}] Failed to create workers:`,
        err.message,
      );
      return;
    }

    // =======================================================================
    // IPC: Text workers
    // =======================================================================

    this[HANDLERS].ipcTextStats = registry.createPipeline(async data => {
      const text = data && data.text;
      if (!text || typeof text !== 'string') {
        return { error: 'Missing required field: text' };
      }
      if (text.length > MAX_TEXT_LENGTH) {
        return {
          error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        };
      }
      return workers.countStats(text);
    });

    this[HANDLERS].ipcTextHash = registry.createPipeline(async data => {
      const text = data && data.text;
      if (text == null || typeof text !== 'string') {
        return { error: 'Missing required field: text' };
      }
      if (text.length > MAX_TEXT_LENGTH) {
        return {
          error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        };
      }
      return workers.hashText(text, data.algorithm);
    });

    this[HANDLERS].ipcTextFind = registry.createPipeline(async data => {
      const text = data && data.text;
      const pattern = data && data.pattern;
      if (!text || !pattern) {
        return { error: 'Missing required fields: text, pattern' };
      }
      if (text.length > MAX_TEXT_LENGTH) {
        return {
          error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        };
      }
      return workers.findPattern(text, pattern, data.caseSensitive);
    });

    // =======================================================================
    // IPC: Math workers
    // =======================================================================

    this[HANDLERS].ipcFibonacci = registry.createPipeline(async data => {
      const n = data && data.n;
      if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
        return { error: 'Field "n" must be a non-negative integer' };
      }
      if (n > MAX_FIBONACCI_N) {
        return { error: `Field "n" exceeds maximum of ${MAX_FIBONACCI_N}` };
      }
      return workers.fibonacci(n);
    });

    this[HANDLERS].ipcIsPrime = registry.createPipeline(async data => {
      const number = data && data.number;
      if (typeof number !== 'number' || !Number.isInteger(number)) {
        return { error: 'Field "number" must be an integer' };
      }
      return workers.isPrime(number);
    });

    this[HANDLERS].ipcSievePrimes = registry.createPipeline(async data => {
      const limit = data && data.limit;
      if (typeof limit !== 'number' || limit < 0 || !Number.isInteger(limit)) {
        return { error: 'Field "limit" must be a non-negative integer' };
      }
      if (limit > MAX_SIEVE_LIMIT) {
        return {
          error: `Field "limit" exceeds maximum of ${MAX_SIEVE_LIMIT}`,
        };
      }
      return workers.sievePrimes(limit);
    });

    // =======================================================================
    // IPC: Pool stats
    // =======================================================================

    this[HANDLERS].ipcStats = registry.createPipeline(async () => {
      return {
        available: true,
        functions: [
          'countStats',
          'hashText',
          'findPattern',
          'fibonacci',
          'isPrime',
          'sievePrimes',
        ],
      };
    });

    // =======================================================================
    // Register all IPC hooks
    // =======================================================================

    const ipcPrefix = `ipc:${__EXTENSION_ID__}`;

    registry.registerHook(
      `${ipcPrefix}:text:stats`,
      this[HANDLERS].ipcTextStats,
      __EXTENSION_ID__,
    );
    registry.registerHook(
      `${ipcPrefix}:text:hash`,
      this[HANDLERS].ipcTextHash,
      __EXTENSION_ID__,
    );
    registry.registerHook(
      `${ipcPrefix}:text:find`,
      this[HANDLERS].ipcTextFind,
      __EXTENSION_ID__,
    );
    registry.registerHook(
      `${ipcPrefix}:math:fibonacci`,
      this[HANDLERS].ipcFibonacci,
      __EXTENSION_ID__,
    );
    registry.registerHook(
      `${ipcPrefix}:math:isPrime`,
      this[HANDLERS].ipcIsPrime,
      __EXTENSION_ID__,
    );
    registry.registerHook(
      `${ipcPrefix}:math:sievePrimes`,
      this[HANDLERS].ipcSievePrimes,
      __EXTENSION_ID__,
    );
    registry.registerHook(
      `${ipcPrefix}:stats`,
      this[HANDLERS].ipcStats,
      __EXTENSION_ID__,
    );

    console.log(`[${__EXTENSION_ID__}] Registered 7 IPC handlers`);
  },

  async shutdown() {
    console.log(`[${__EXTENSION_ID__}] Shutting down worker demo extension`);

    // Cleanup workers reference
    if (this[WORKERS]) {
      this[WORKERS] = null;
    }

    // Clear handler references
    this[HANDLERS] = {};

    console.log(`[${__EXTENSION_ID__}] Shutdown complete`);
  },
};
