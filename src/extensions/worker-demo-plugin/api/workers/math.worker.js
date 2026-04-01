/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Math Computation Worker — Stateless Piscina worker for CPU-bound math tasks.
 *
 * Each named export maps to a messageType in sendRequest().
 * Workers receive a SINGLE data argument and must return serializable results.
 */

/**
 * Compute the Nth Fibonacci number using iterative approach.
 * Deliberately CPU-intensive for large N to demonstrate worker thread benefit.
 *
 * @param {{ n: number }} data
 * @returns {{ n: number, result: number, elapsed: number }}
 */
export function FIBONACCI(data) {
  const { n } = data;
  const start = Date.now();

  if (n < 0) {
    throw new Error('Fibonacci requires a non-negative integer');
  }
  if (n <= 1) {
    return { n, result: n, elapsed: Date.now() - start };
  }

  let prev = 0;
  let curr = 1;
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }

  return { n, result: curr, elapsed: Date.now() - start };
}

/**
 * Check if a number is prime using trial division.
 *
 * @param {{ number: number }} data
 * @returns {{ number: number, isPrime: boolean, elapsed: number }}
 */
export function IS_PRIME(data) {
  const { number } = data;
  const start = Date.now();

  if (number < 2) {
    return { number, isPrime: false, elapsed: Date.now() - start };
  }
  if (number < 4) {
    return { number, isPrime: true, elapsed: Date.now() - start };
  }
  if (number % 2 === 0 || number % 3 === 0) {
    return { number, isPrime: false, elapsed: Date.now() - start };
  }

  for (let i = 5; i * i <= number; i += 6) {
    if (number % i === 0 || number % (i + 2) === 0) {
      return { number, isPrime: false, elapsed: Date.now() - start };
    }
  }

  return { number, isPrime: true, elapsed: Date.now() - start };
}

/**
 * Generate prime numbers up to a limit using Sieve of Eratosthenes.
 * CPU-intensive for large limits — perfect for worker thread offloading.
 *
 * @param {{ limit: number }} data
 * @returns {{ limit: number, primes: number[], count: number, elapsed: number }}
 */
export function SIEVE_PRIMES(data) {
  const { limit } = data;
  const start = Date.now();

  if (limit < 2) {
    return { limit, primes: [], count: 0, elapsed: Date.now() - start };
  }

  const sieve = new Uint8Array(limit + 1);
  sieve[0] = 1;
  sieve[1] = 1;

  for (let i = 2; i * i <= limit; i++) {
    if (!sieve[i]) {
      for (let j = i * i; j <= limit; j += i) {
        sieve[j] = 1;
      }
    }
  }

  const primes = [];
  for (let i = 2; i <= limit; i++) {
    if (!sieve[i]) primes.push(i);
  }

  return { limit, primes, count: primes.length, elapsed: Date.now() - start };
}
