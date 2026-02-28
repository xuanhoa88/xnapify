// Stress benchmark for plugin IPC via the PluginRegistry
// Registers many handlers and issues many concurrent executeHook calls

const { performance } = require('perf_hooks');
const PluginRegistry = require('../shared/plugin/Registry').default;

describe('plugin IPC stress', () => {
  let registry;
  const hookId = 'ipc:stress-plugin:echo';

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  it('registers many handlers and handles high request concurrency', async () => {
    const handlers = 50; // number of handlers registered for the hook
    const requests = 1000; // total number of concurrent requests to issue
    const concurrencyBatch = 200; // run in batches to avoid OOM on small machines

    // Register handlers - each returns the payload and its handler index
    for (let i = 0; i < handlers; i++) {
      registry.registerHook(hookId, async data => ({ i, data }), `plugin-${i}`);
    }

    const payload = { message: 'ping' };

    // Helper to run a single request
    const runRequest = async () => {
      const results = await registry.executeHook(hookId, payload, { ctx: 'bench' });
      // basic sanity: results length should equal handlers
      if (!Array.isArray(results)) throw new Error('results not an array');
      return results;
    };

    const start = performance.now();

    // Execute requests in batches to control concurrency
    const batches = Math.ceil(requests / concurrencyBatch);
    for (let b = 0; b < batches; b++) {
      const batchSize = Math.min(concurrencyBatch, requests - b * concurrencyBatch);
      const arr = new Array(batchSize).fill(0).map(() => runRequest());
      const resolved = await Promise.all(arr);

      // quick check for this batch
      for (const res of resolved) {
        if (res.length !== handlers) throw new Error('handler count mismatch');
      }
    }

    const duration = performance.now() - start;
    const throughput = (requests / duration) * 1000; // req/sec

    console.log(`${requests} IPC requests (x${handlers} handlers) handled in ${duration.toFixed(2)}ms`);
    console.log(`throughput: ${Math.round(throughput)} req/s`);

    // Sanity assertions - keep generous thresholds for CI variability
    expect(duration).toBeLessThan(30000); // entire stress test should finish under 30s
    expect(throughput).toBeGreaterThan(0);
  }, 40000);
});
