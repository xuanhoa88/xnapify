// Production-grade extension IPC stress benchmark
// - Creates a lightweight Express server exposing POST /api/plugins/:id/ipc
// - Registers many handlers on the registry (simulating plugins)
// - Fires many concurrent HTTP requests to measure routing, serialization, and registry execution costs

const { performance } = require('perf_hooks');

const bodyParser = require('body-parser');
const express = require('express');
const fetch = require('node-fetch');

const ExtensionRegistryClass = require('@shared/extension/utils/Registry').default;

// Configurable via environment variables (with sensible defaults)
const HANDLERS = parseInt(process.env.BENCH_HANDLERS || '50', 10);
const REQUESTS = parseInt(process.env.BENCH_REQUESTS || '1000', 10);
const CONCURRENCY = parseInt(process.env.BENCH_CONCURRENCY || '200', 10);
const PAYLOAD_BYTES = parseInt(process.env.BENCH_PAYLOAD_BYTES || '256', 10);
const PLUGIN_ID = process.env.BENCH_PLUGIN_ID || 'stress-plugin';
const BENCH_IO_MS = parseInt(process.env.BENCH_IO_MS || '0', 10);
const RECORD_PATH = process.env.BENCH_RECORD || '';

function makePayload(bytes) {
  // repeat a small string to reach desired size
  const base = 'x'.repeat(Math.min(64, bytes));
  let p = '';
  while (Buffer.byteLength(p) < bytes) p += base;
  return { message: 'ping', blob: p };
}

// Create express app and route that proxies to a fresh ExtensionRegistry instance
function createApp(registry) {
  const app = express();
  app.use(bodyParser.json({ limit: '1mb' }));

  app.post('/api/plugins/:id/ipc', async (req, res) => {
    const { id } = req.params;
    const { action, data } = req.body || {};
    if (!action) return res.status(400).json({ error: 'missing action' });

    const hookId = `ipc:${id}:${action}`;
    if (!registry.hasHook(hookId))
      return res.status(404).json({ error: 'no-handler' });

    try {
      const results = await registry.executeHook(hookId, data, {
        reqId: req.headers['x-req-id'],
      });
      return res.json({ ok: true, results: results.slice(0, 5) }); // limit payload for response
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  });

  return app;
}

describe('plugin-ipc-prod', () => {
  let server;
  let url;
  let registry;

  beforeAll(done => {
    registry = new ExtensionRegistryClass();

    // Register handlers for PLUGIN_ID:action="echo"
    for (let i = 0; i < HANDLERS; i++) {
      // simulate lightweight async handler; optionally include I/O latency
      registry.registerHook(
        `ipc:${PLUGIN_ID}:echo`,
        async payload => {
          if (BENCH_IO_MS > 0) {
            await new Promise(r => setTimeout(r, BENCH_IO_MS));
          }
          let s = 0;
          for (let j = 0; j < 5; j++)
            // eslint-disable-next-line no-unused-vars
            s += payload && payload.blob ? payload.blob.length : 0;
          return { handler: i, ok: true };
        },
        `plugin-${i}`,
      );
    }

    const app = createApp(registry);
    server = app.listen(0, () => {
      const { port } = server.address();
      url = `http://127.0.0.1:${port}/api/plugins/${PLUGIN_ID}/ipc`;
      done();
    });
  });

  afterAll(done => {
    if (server) server.close(done);
    else done();
  });

  test('HTTP IPC stress test', async () => {
    const payload = makePayload(PAYLOAD_BYTES);
    const actionBody = { action: 'echo', data: payload };

    const batches = Math.ceil(REQUESTS / CONCURRENCY);
    const start = performance.now();
    const perRequest = [];

    for (let b = 0; b < batches; b++) {
      const batchSize = Math.min(CONCURRENCY, REQUESTS - b * CONCURRENCY);
      const promises = new Array(batchSize).fill(0).map(async () => {
        const t0 = performance.now();
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actionBody),
        });
        await r.json();
        const dt = performance.now() - t0;
        perRequest.push(dt);
        return dt;
      });

      const results = await Promise.all(promises);
      for (const r of results) {
        if (!r) throw new Error('bad response');
      }
    }

    const duration = performance.now() - start;
    const throughput = (REQUESTS / duration) * 1000;

    console.log(
      `HTTP IPC: ${REQUESTS} requests x ${HANDLERS} handlers in ${duration.toFixed(2)}ms`,
    );
    console.log(`throughput: ${Math.round(throughput)} req/s`);

    if (RECORD_PATH) {
      try {
        const fs = require('fs');
        const path = require('path');
        const outDir = path.dirname(RECORD_PATH);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const res = {
          timestamp: new Date().toISOString(),
          config: {
            HANDLERS,
            REQUESTS,
            CONCURRENCY,
            PAYLOAD_BYTES,
            BENCH_IO_MS,
          },
          duration,
          throughput,
          latencies: {
            min: Math.min(...perRequest),
            max: Math.max(...perRequest),
            median:
              perRequest.sort((a, b) => a - b)[
                Math.floor(perRequest.length / 2)
              ] || 0,
          },
        };
        fs.writeFileSync(RECORD_PATH, JSON.stringify(res, null, 2));
        console.log(`Wrote benchmark record to ${RECORD_PATH}`);
      } catch (err) {
        console.error('Failed to write record:', err);
      }
    }

    expect(duration).toBeLessThan(60000);
    expect(throughput).toBeGreaterThan(0);
  }, 120000);
});
