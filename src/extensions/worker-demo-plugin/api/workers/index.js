/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Demo Pool — Creates a Piscina-backed worker pool for the demo extension.
 * Discovers text.worker.js and math.worker.js via require.context.
 */

import { createWorkerPool } from '@shared/api/engines/worker';

// Auto-discover *.worker.js files in this directory
const workersContext = require.context('./', false, /\.worker\.[cm]?[jt]s$/i);

const WORKER_TIMEOUT_MS = 30_000;

const workerPool = createWorkerPool('WorkerDemo', workersContext, {
  maxWorkers: 2,
  workerTimeout: WORKER_TIMEOUT_MS,
});

// =========================================================================
// Convenience methods — domain-specific API over sendRequest
// =========================================================================

/**
 * Count text statistics (words, characters, lines, sentences).
 *
 * @param {string} text - Text to analyze
 * @returns {Promise<{ words: number, characters: number, lines: number, sentences: number }>}
 */
workerPool.countStats = async function countStats(text) {
  const { result } = await this.sendRequest(
    'text',
    'COUNT_STATS',
    { text },
    { throwOnError: true },
  );
  return result;
};

/**
 * Compute SHA-256 hash of text.
 *
 * @param {string} text - Text to hash
 * @param {string} [algorithm='sha256'] - Hash algorithm
 * @returns {Promise<{ hash: string, algorithm: string }>}
 */
workerPool.hashText = async function hashText(text, algorithm) {
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
 *
 * @param {string} text - Text to search
 * @param {string} pattern - Regex pattern
 * @param {boolean} [caseSensitive=false] - Case sensitivity flag
 * @returns {Promise<{ matches: Array, count: number }>}
 */
workerPool.findPattern = async function findPattern(
  text,
  pattern,
  caseSensitive,
) {
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
 *
 * @param {number} n - Position in Fibonacci sequence
 * @returns {Promise<{ n: number, result: number, elapsed: number }>}
 */
workerPool.fibonacci = async function fibonacci(n) {
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
 *
 * @param {number} number - Number to check
 * @returns {Promise<{ number: number, isPrime: boolean, elapsed: number }>}
 */
workerPool.isPrime = async function isPrime(number) {
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
 *
 * @param {number} limit - Upper bound
 * @returns {Promise<{ limit: number, primes: number[], count: number, elapsed: number }>}
 */
workerPool.sievePrimes = async function sievePrimes(limit) {
  const { result } = await this.sendRequest(
    'math',
    'SIEVE_PRIMES',
    { limit },
    { throwOnError: true },
  );
  return result;
};

export default workerPool;
