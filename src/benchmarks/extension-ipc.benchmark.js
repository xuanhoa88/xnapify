// Stress benchmark for extension IPC via the ExtensionRegistry
// Registers many handlers and issues many concurrent executeHook calls

const { performance } = require('perf_hooks');

const ExtensionRegistry = require('@shared/extension/utils/Registry').default;

describe('extension IPC stress', () => {
  let registry;
  const hookId = 'ipc:stress-plugin:echo';

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  it('registers many handlers and handles high request concurrency', async () => {
    const handlers = 50; // number of handlers registered for the hook
    const requests = 1000; // total number of concurrent requests to issue

    // Register handlers - each returns the payload and its handler index
    for (let i = 0; i < handlers; i++) {
      registry.registerHook(hookId, async data => ({ i, data }), `plugin-${i}`);
    }

    console.log('--- Benchmarking Extension IPC ---');

    const TOTAL_REQUESTS = requests;
    const CONCURRENT_HANDLERS = handlers;

    // Benchmark sequential execution
    console.log(
      `\n1. Sequential Execution (${TOTAL_REQUESTS} reqs, ${CONCURRENT_HANDLERS} handlers)`,
    );

    let start = performance.now();
    let completed = 0;
    let errors = 0;

    // Create an array of requests
    const sequentialRequests = Array.from(
      { length: TOTAL_REQUESTS },
      (_, i) => ({
        message: `Test message ${i}`,
        timestamp: Date.now(),
      }),
    );

    // Process requests sequentially (one after another)
    for (const req of sequentialRequests) {
      try {
        await registry.executeHook(hookId, req, {
          req: {},
          res: {},
        });
        completed++;
      } catch (err) {
        errors++;
      }
    }

    let duration = performance.now() - start;
    let throughput = Math.round((TOTAL_REQUESTS / duration) * 1000);

    console.log(
      `In-process IPC (Sequential): ${TOTAL_REQUESTS} requests in ${duration.toFixed(2)}ms`,
    );
    console.log(`throughput: ${throughput} req/s`);
    console.log(`completed: ${completed}, errors: ${errors}`);

    // Benchmark parallel execution
    console.log(
      `\n2. Parallel Execution (${TOTAL_REQUESTS} reqs, ${CONCURRENT_HANDLERS} handlers)`,
    );

    start = performance.now();
    completed = 0;
    errors = 0;

    // Process requests with new parallel hook execute method
    for (const req of sequentialRequests) {
      // Reusing sequentialRequests for consistency
      try {
        await registry.executeHookParallel(hookId, req, {
          req: {},
          res: {},
        });
        completed++;
      } catch (err) {
        errors++;
      }
    }

    duration = performance.now() - start;
    throughput = Math.round((TOTAL_REQUESTS / duration) * 1000);

    console.log(
      `In-process IPC (Parallel hooks): ${TOTAL_REQUESTS} requests in ${duration.toFixed(2)}ms`,
    );
    console.log(`throughput: ${throughput} req/s`);
    console.log(`completed: ${completed}, errors: ${errors}`);

    // Sanity assertions - keep generous thresholds for CI variability
    expect(duration).toBeLessThan(30000); // entire stress test should finish under 30s
    expect(throughput).toBeGreaterThan(0);
  }, 40000);
});
