/**
 * Auth Middleware Performance Benchmark
 *
 * Measures JWT verification with and without caching.
 * Run via: npm run test:benchmark
 */
const { performance } = require('perf_hooks');

describe('auth.benchmark', () => {
  let requireAuth;

  beforeAll(() => {
    // Load via Jest transpilation (avoids ES module issues)
    const authMiddleModule = require('@shared/api/engines/auth/middlewares');

    requireAuth = authMiddleModule.requireAuth;
  });

  const jwtMock = {
    decodeToken: () => ({ payload: { type: 'access' } }),
    verifyTypedToken: () => ({ id: 123, type: 'access' }),
  };

  function makeReq(token) {
    return {
      headers: {
        authorization: 'Bearer ' + token,
      },
      cookies: {},
      query: {},
      app: {
        get: key => (key === 'jwt' ? jwtMock : null),
      },
    };
  }

  it('measures auth throughput (cold and warm cache)', async () => {
    const count = 5000;
    const token = 'benchmark-token';

    const middleware = requireAuth();
    const req = makeReq(token);
    const res = { status: () => res, json: () => res };
    const next = () => {};

    const start1 = performance.now();
    for (let i = 0; i < count; i++) {
      await middleware(req, res, next);
    }
    const duration1 = performance.now() - start1;
    const throughput1 = count / (duration1 / 1000);

    console.log(
      '\n  Cold cache:  ' +
        duration1.toFixed(1) +
        'ms (' +
        throughput1.toFixed(0) +
        ' req/s)',
    );

    const start2 = performance.now();
    for (let i = 0; i < count; i++) {
      await middleware(req, res, next);
    }
    const duration2 = performance.now() - start2;
    const throughput2 = count / (duration2 / 1000);

    console.log(
      '  Warm cache:  ' +
        duration2.toFixed(1) +
        'ms (' +
        throughput2.toFixed(0) +
        ' req/s)',
    );

    const speedup = duration1 / duration2;
    console.log('  Speedup:     ' + speedup.toFixed(1) + 'x\n');

    expect(throughput2).toBeGreaterThanOrEqual(throughput1 * 0.8);
  });
});
