/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Demo — Convenience API over math and text worker functions.
 */

import { fibonacci, isPrime, sievePrimes } from './math.worker';
import { countStats, findPattern, hashText } from './text.worker';

/**
 * Create the worker demo API object with convenience methods.
 *
 * @returns {Object} Worker demo API
 */
export function createDemoWorkers() {
  return {
    /**
     * Count text statistics (words, characters, lines, sentences).
     */
    async countStats(text) {
      return await countStats({ text });
    },

    /**
     * Compute hash of text.
     */
    async hashText(text, algorithm) {
      return await hashText({ text, algorithm });
    },

    /**
     * Find pattern occurrences in text.
     */
    async findPattern(text, pattern, caseSensitive) {
      return await findPattern({ text, pattern, caseSensitive });
    },

    /**
     * Compute Nth Fibonacci number.
     */
    async fibonacci(n) {
      return await fibonacci({ n });
    },

    /**
     * Check if a number is prime.
     */
    async isPrime(number) {
      return await isPrime({ number });
    },

    /**
     * Generate primes up to a limit using Sieve of Eratosthenes.
     */
    async sievePrimes(limit) {
      return await sievePrimes({ limit });
    },
  };
}
