// Simple benchmark example
// Run using `npm run test:benchmark` (or `node tools/run benchmark`)
// Benchmarks are plain Jest tests that log timing information.

const { performance } = require('perf_hooks');

// A toy function to measure
function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

describe('fibonacci performance', () => {
  it('computes fibonacci(30) in under a reasonable time', () => {
    const start = performance.now();
    const result = fibonacci(30);
    const duration = performance.now() - start;
    console.log(`fibonacci(30) took ${duration.toFixed(2)}ms`);
    expect(result).toBe(832040); // sanity check
  });
});
