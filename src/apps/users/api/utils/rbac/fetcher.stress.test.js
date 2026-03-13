import { performance } from 'perf_hooks';

import { fetchUserRBACData } from './fetcher';

// Mock collector to produce deterministic RBAC data
jest.mock('./collector', () => ({
  collectUserRBACData: jest.fn(user => ({
    roles: user.roles ? user.roles.map(r => r.name) : [],
    groups: user.groups ? user.groups.map(g => g.name) : [],
    permissions: [],
  })),
}));

// Provide a simple in-memory cache implementation for the module
jest.mock('./cache', () => {
  const store = new Map();
  return {
    getUser: jest.fn((id, _cache) => store.get(id)),
    setUser: jest.fn((id, data, _cache) => store.set(id, data)),
    _store: store,
    _clear: () => store.clear(),
  };
});

describe('RBAC Fetcher Stress Test', () => {
  jest.setTimeout(120000);

  const DB_LATENCY_MS = 8; // simulated DB latency per call
  const TOTAL_REQUESTS = 2000;

  let modelsMock;
  let cacheMock;

  beforeEach(() => {
    cacheMock = {};
    // Simulated user object returned by DB
    const mockUser = {
      id: 'stress-user',
      roles: [{ name: 'user' }],
      groups: [],
    };

    modelsMock = {
      User: {
        findByPk: jest.fn(async () => {
          // simulate small DB latency
          await new Promise(r => setTimeout(r, DB_LATENCY_MS));
          return mockUser;
        }),
      },
      Role: {},
      Group: {},
      Permission: {},
    };
  });

  it('handles high concurrency and benefits from caching', async () => {
    // Cold run (cache empty) — fire many concurrent requests
    const coldPromises = Array.from({ length: TOTAL_REQUESTS }, () =>
      fetchUserRBACData('stress-user', {
        models: modelsMock,
        cache: cacheMock,
      }),
    );

    const t0 = performance.now();
    await Promise.all(coldPromises);
    const t1 = performance.now();
    const coldMs = t1 - t0;

    // Warm run: ensure cache returns value immediately
    const warmPromises = Array.from({ length: TOTAL_REQUESTS }, () =>
      fetchUserRBACData('stress-user', {
        models: modelsMock,
        cache: cacheMock,
      }),
    );

    const t2 = performance.now();
    await Promise.all(warmPromises);
    const t3 = performance.now();
    const warmMs = t3 - t2;

    // Log basic metrics for observation
    // eslint-disable-next-line no-console
    console.log(
      `fetcher stress: cold=${Math.round(coldMs)}ms warm=${Math.round(warmMs)}ms`,
    );

    // Expectations: warm run should be faster than cold run and DB was called exactly once
    expect(warmMs).toBeLessThan(coldMs);
    // Because of request coalescing, 2000 concurrent requests result in exactly 1 DB query
    expect(modelsMock.User.findByPk).toHaveBeenCalledTimes(1);
  });
});
