Extension IPC Benchmarks

This folder contains several benchmarks for extension IPC and renderer:

- `composer.benchmark.js` - middleware composition stress tests
- `extensionIpc.benchmark.js` - in-process registry stress test (fast, no HTTP)
- `extensionIpcProd.benchmark.js` - production-grade HTTP-level stress test
- `renderer.benchmark.js`, `example.benchmark.js` - renderer and example tests

Running

- Run all benchmarks:

```bash
npm run test:benchmark
```

- Run only the production-grade extension IPC benchmark:

```bash
# optional env overrides
BENCH_HANDLERS=100 BENCH_REQUESTS=5000 BENCH_CONCURRENCY=500 BENCH_PAYLOAD_BYTES=1024 \
  npm run test:benchmark -- --testNamePattern=extensionIpcProd
```

Notes

- The HTTP benchmark starts a small Express server bound to an ephemeral port and posts JSON requests to `/api/extensions/:id/ipc`.
- Adjust environment variables to simulate different load profiles.
- Keep thresholds in tests generous for CI variance. For deeper profiling, capture `process.hrtime` or use external profilers.

