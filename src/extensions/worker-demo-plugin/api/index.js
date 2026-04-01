/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Demo Plugin — Backend Extension
 *
 * Demonstrates the Worker Engine (shared/api/engines/worker) by:
 * - Creating a Piscina-backed worker pool with text + math workers
 * - Exposing worker tasks via IPC endpoints
 * - Providing pool stats via IPC
 * - Properly cleaning up on shutdown
 */

import workerPool from './workers';

// Private symbol for handler storage (cleanup symmetry)
const HANDLERS = Symbol('handlers');

// Maximum limits for IPC safety
const MAX_FIBONACCI_N = 10_000;
const MAX_SIEVE_LIMIT = 1_000_000;
const MAX_TEXT_LENGTH = 100_000;

export default {
  [HANDLERS]: {},

  async boot({ registry }) {
    console.log(`[${__EXTENSION_ID__}] Booting worker demo extension`);

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
      return workerPool.countStats(text);
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
      return workerPool.hashText(text, data.algorithm);
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
      return workerPool.findPattern(text, pattern, data.caseSensitive);
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
      return workerPool.fibonacci(n);
    });

    this[HANDLERS].ipcIsPrime = registry.createPipeline(async data => {
      const number = data && data.number;
      if (typeof number !== 'number' || !Number.isInteger(number)) {
        return { error: 'Field "number" must be an integer' };
      }
      return workerPool.isPrime(number);
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
      return workerPool.sievePrimes(limit);
    });

    // =======================================================================
    // IPC: Pool stats
    // =======================================================================

    this[HANDLERS].ipcPoolStats = registry.createPipeline(async () => {
      return workerPool.getStats();
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
      `${ipcPrefix}:pool:stats`,
      this[HANDLERS].ipcPoolStats,
      __EXTENSION_ID__,
    );

    console.log(`[${__EXTENSION_ID__}] Registered 7 IPC handlers`);
  },

  async shutdown() {
    console.log(`[${__EXTENSION_ID__}] Shutting down worker demo extension`);

    // Cleanup worker pool threads
    await workerPool.cleanup();

    // Clear handler references
    this[HANDLERS] = {};

    console.log(`[${__EXTENSION_ID__}] Shutdown complete`);
  },
};
