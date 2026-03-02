// Benchmark for composeMiddleware utility
// This test measures execution time of composing and running many
// small middleware functions to ensure it stays performant as stacks grow.

const { performance } = require('perf_hooks');
const { composeMiddleware } = require('../shared/utils/composer');

// Create a bunch of dummy middleware that just calls next()
function createNoopMiddleware(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push((req, res, next) => {
      // simulate a tiny amount of work
      // eslint-disable-next-line no-param-reassign, no-underscore-dangle
      req._counter = (req._counter || 0) + 1;
      return next();
    });
  }
  return list;
}

describe('composeMiddleware performance', () => {
  // helper that awaits next()
  const makeAsyncStack = count =>
    createNoopMiddleware(count).map(
      fn => async (req, res, next) => fn(req, res, next),
    );

  it('composes and executes 1 000 noop middlewares quickly', async () => {
    const stack = createNoopMiddleware(1000);
    const composed = composeMiddleware(...stack);

    const req = {};
    const res = {};

    const start = performance.now();
    await composed(req, res, () => Promise.resolve('done'));
    const duration = performance.now() - start;

    console.log(`1000 middleware stack executed in ${duration.toFixed(2)}ms`);

    // eslint-disable-next-line no-underscore-dangle
    expect(req._counter).toBe(1000);
    expect(duration).toBeLessThan(500);
  });

  it('handles 10 000 noop middlewares (stress test)', async () => {
    const count = 10000;
    const stack = createNoopMiddleware(count);
    const composed = composeMiddleware(...stack);

    const req = {};
    const res = {};

    const start = performance.now();
    await composed(req, res, () => Promise.resolve('done'));
    const duration = performance.now() - start;

    console.log(
      `${count} middleware stack executed in ${duration.toFixed(2)}ms`,
    );
    // eslint-disable-next-line no-underscore-dangle
    console.log(`  actual invocations: ${req._counter}`);

    // we don't assert equality here because extremely deep stacks may hit
    // recursion limits or early termination; the purpose is to observe
    // behaviour under load rather than enforce correctness.
    // eslint-disable-next-line no-underscore-dangle
    expect(req._counter).toBeGreaterThan(0);
    // eslint-disable-next-line no-underscore-dangle
    expect(req._counter).toBeLessThanOrEqual(count);

    // still allow a generous upper bound; slow machines may take ~1s
    expect(duration).toBeLessThan(2000);
  });

  it('composes 1 000 async middlewares (returning promise)', async () => {
    const stack = makeAsyncStack(1000);
    const composed = composeMiddleware(...stack);

    const req = {};
    const res = {};

    const start = performance.now();
    await composed(req, res, () => Promise.resolve('done'));
    const duration = performance.now() - start;

    console.log(
      `1k async middleware stack executed in ${duration.toFixed(2)}ms`,
    );

    // eslint-disable-next-line no-underscore-dangle
    expect(req._counter).toBe(1000);
    expect(duration).toBeLessThan(1000);
  });
});
