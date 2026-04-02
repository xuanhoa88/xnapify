/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Demo Pool — Creates a Piscina-backed worker pool for the demo extension.
 *
 * Workers are discovered from pre-compiled standalone CJS files at
 * `<bundleDir>/workers/`.
 *
 * IMPORTANT: Pool creation is lazy (via factory) to avoid blocking the event
 * loop at module-load time when the extension bundle is loaded by nativeRequire.
 */

import { createWorkerPool } from '@shared/api/engines/worker';

const WORKER_TIMEOUT_MS = 30_000;

/**
 * Create the worker pool and attach convenience methods.
 * Called once from boot() to defer initialization.
 *
 * @returns {Object} Worker pool instance with domain-specific methods
 */
export function createDemoWorkerPool() {
  const pool = createWorkerPool('WorkerDemo', {
    maxWorkers: 2,
    workerTimeout: WORKER_TIMEOUT_MS,
    forceFork: true,
  });

  // =========================================================================
  // Convenience methods — domain-specific API over sendRequest
  // =========================================================================

  /**
   * Count text statistics (words, characters, lines, sentences).
   */
  pool.countStats = async function countStats(text) {
    const { result } = await this.sendRequest(
      'text',
      'COUNT_STATS',
      { text },
      { throwOnError: true },
    );
    return result;
  };

  /**
   * Compute hash of text.
   */
  pool.hashText = async function hashText(text, algorithm) {
    const { result } = await this.sendRequest(
      'text',
      'HASH_TEXT',
      { text, algorithm },
      { throwOnError: true },
    );
    return result;
  };

  /**
   * Find pattern occurrences in text.
   */
  pool.findPattern = async function findPattern(text, pattern, caseSensitive) {
    const { result } = await this.sendRequest(
      'text',
      'FIND_PATTERN',
      { text, pattern, caseSensitive },
      { throwOnError: true },
    );
    return result;
  };

  /**
   * Compute Nth Fibonacci number.
   */
  pool.fibonacci = async function fibonacci(n) {
    const { result } = await this.sendRequest(
      'math',
      'FIBONACCI',
      { n },
      { throwOnError: true },
    );
    return result;
  };

  /**
   * Check if a number is prime.
   */
  pool.isPrime = async function isPrime(number) {
    const { result } = await this.sendRequest(
      'math',
      'IS_PRIME',
      { number },
      { throwOnError: true },
    );
    return result;
  };

  /**
   * Generate primes up to a limit using Sieve of Eratosthenes.
   */
  pool.sievePrimes = async function sievePrimes(limit) {
    const { result } = await this.sendRequest(
      'math',
      'SIEVE_PRIMES',
      { limit },
      { throwOnError: true },
    );
    return result;
  };

  return pool;
}
