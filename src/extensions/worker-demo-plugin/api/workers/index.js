/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Worker Demo — Convenience API over math and text worker functions.
 *
 * CPU-bound functions are dispatched to the Worker engine thread pool
 * via `worker.run()`. This keeps the main event loop unblocked.
 */

/**
 * Create the worker demo API object with convenience methods.
 *
 * @param {import('@shared/api/engines/worker').WorkerPoolManager} worker
 * @returns {Object} Worker demo API
 */
export function createDemoWorkers(worker) {
  return {
    /**
     * Count text statistics (words, characters, lines, sentences).
     */
    async countStats(text) {
      return await worker.run('text', 'countStats', { text });
    },

    /**
     * Compute hash of text.
     */
    async hashText(text, algorithm) {
      return await worker.run('text', 'hashText', { text, algorithm });
    },

    /**
     * Find pattern occurrences in text.
     */
    async findPattern(text, pattern, caseSensitive) {
      return await worker.run('text', 'findPattern', {
        text,
        pattern,
        caseSensitive,
      });
    },

    /**
     * Compute Nth Fibonacci number.
     */
    async fibonacci(n) {
      return await worker.run('math', 'fibonacci', { n });
    },

    /**
     * Check if a number is prime.
     */
    async isPrime(number) {
      return await worker.run('math', 'isPrime', { number });
    },

    /**
     * Generate primes up to a limit using Sieve of Eratosthenes.
     */
    async sievePrimes(limit) {
      return await worker.run('math', 'sievePrimes', { limit });
    },
  };
}
