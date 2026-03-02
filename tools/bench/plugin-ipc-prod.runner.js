#!/usr/bin/env node
// Standalone production-grade plugin IPC benchmark runner
// Usage (defaults):
//   node tools/bench/plugin-ipc-prod.runner.js
// Environment variables:
//   BENCH_HANDLERS, BENCH_REQUESTS, BENCH_CONCURRENCY, BENCH_PAYLOAD_BYTES
//   BENCH_PLUGIN_ID, BENCH_IO_MS (avg simulated I/O in ms), BENCH_RECORD (path)

const express = require('express');
const fetch = require('node-fetch');
const http = require('http');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
// Use an internal lightweight registry to avoid requiring ES modules
class SimpleRegistry {
  constructor() {
    this.hooks = new Map();
  }

  registerHook(hookId, callback /*, pluginId */) {
    if (!this.hooks.has(hookId)) this.hooks.set(hookId, []);
    this.hooks.get(hookId).push(callback);
  }

  hasHook(hookId) {
    const cbs = this.hooks.get(hookId);
    return !!cbs && cbs.length > 0;
  }

  async executeHook(hookId, ...args) {
    const cbs = this.hooks.get(hookId) || [];
    const results = [];
    for (const cb of cbs) {
      try {
        results.push(await cb(...args));
      } catch (err) {
        // swallow
      }
    }
    return results;
  }
}

const PluginRegistryClass = SimpleRegistry;

const HANDLERS = parseInt(process.env.BENCH_HANDLERS || '10', 10);
const REQUESTS = parseInt(process.env.BENCH_REQUESTS || '2000', 10);
const CONCURRENCY = parseInt(process.env.BENCH_CONCURRENCY || '500', 10);
const PAYLOAD_BYTES = parseInt(process.env.BENCH_PAYLOAD_BYTES || '256', 10);
const PLUGIN_ID = process.env.BENCH_PLUGIN_ID || 'stress-plugin';
const BENCH_IO_MS = parseInt(process.env.BENCH_IO_MS || '0', 10); // avg simulated I/O
const RECORD_PATH = process.env.BENCH_RECORD || '';

function makePayload(bytes) {
  const base = 'x'.repeat(Math.min(64, bytes));
  let p = '';
  while (Buffer.byteLength(p) < bytes) p += base;
  return { message: 'ping', blob: p };
}

function createApp(registry) {
  const app = express();
  // Use express.json (built-in) instead of body-parser for better performance
  app.use(express.json({ limit: '1mb' }));

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
      return res.json({ ok: true, results: results.slice(0, 5) });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  });

  return app;
}

(async () => {
  const registry = new PluginRegistryClass();

  // Register handlers
  for (let i = 0; i < HANDLERS; i++) {
    registry.registerHook(
      `ipc:${PLUGIN_ID}:echo`,
      async payload => {
        if (BENCH_IO_MS > 0) {
          // simulate I/O latency with a Promise-based delay
          await new Promise(r => setTimeout(r, BENCH_IO_MS));
        }
        // light CPU work
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
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/plugins/${PLUGIN_ID}/ipc`;
  console.log(`Started server at ${url}`);

  // Create HTTP agent with keep-alive for connection reuse (major performance win)
  const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: CONCURRENCY,
    maxFreeSockets: CONCURRENCY,
    timeout: 30000,
    freeSocketTimeout: 30000,
  });

  const payload = makePayload(PAYLOAD_BYTES);
  const bodyStr = JSON.stringify({ action: 'echo', data: payload });

  const batches = Math.ceil(REQUESTS / CONCURRENCY);
  const perRequestLatencies = [];

  const startAll = performance.now();
  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS - b * CONCURRENCY);
    const promises = new Array(batchSize).fill(0).map(async () => {
      const t0 = performance.now();
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        agent: httpAgent,
      });
      await r.json();
      const t1 = performance.now();
      const dt = t1 - t0;
      perRequestLatencies.push(dt);
      return dt;
    });

    await Promise.all(promises);
  }
  const duration = performance.now() - startAll;
  const throughput = (REQUESTS / duration) * 1000;

  console.log(
    `HTTP IPC: ${REQUESTS} requests x ${HANDLERS} handlers in ${duration.toFixed(2)}ms`,
  );
  console.log(`throughput: ${Math.round(throughput)} req/s`);

  if (RECORD_PATH) {
    try {
      const outDir = path.dirname(RECORD_PATH);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const result = {
        timestamp: new Date().toISOString(),
        config: { HANDLERS, REQUESTS, CONCURRENCY, PAYLOAD_BYTES, BENCH_IO_MS },
        duration,
        throughput,
        latencies: {
          min: Math.min(...perRequestLatencies),
          max: Math.max(...perRequestLatencies),
          median:
            perRequestLatencies.sort((a, b) => a - b)[
              Math.floor(perRequestLatencies.length / 2)
            ] || 0,
        },
      };
      fs.writeFileSync(RECORD_PATH, JSON.stringify(result, null, 2));
      console.log(`Wrote results to ${RECORD_PATH}`);
    } catch (err) {
      console.error('Failed to write record:', err);
    }
  }

  server.close();
  process.exit(0);
})();
