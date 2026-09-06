/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import {
  configureRateLimitStore,
  createRateLimiter,
  resolveRateLimiter,
} from './rateLimit.js';

function fakeStore() {
  return {
    init: jest.fn(),
    increment: jest.fn(async () => ({ totalHits: 1, resetTime: new Date() })),
    decrement: jest.fn(),
    resetKey: jest.fn(),
    localKeys: false,
  };
}

describe('configureRateLimitStore', () => {
  afterEach(() => {
    configureRateLimitStore(null);
  });

  it('backs every limiter with the shared store factory', async () => {
    const factory = jest.fn(() => fakeStore());
    configureRateLimitStore(factory);

    const limiter = await createRateLimiter(
      { windowMs: 60_000, max: 5, validate: false },
      'route-a',
    );
    expect(typeof limiter).toBe('function');
    expect(factory).toHaveBeenCalledWith('route-a');

    // Same key → cached limiter, no second store
    await createRateLimiter(
      { windowMs: 60_000, max: 5, validate: false },
      'route-a',
    );
    expect(factory).toHaveBeenCalledTimes(1);

    // Different key → its own store namespace
    await createRateLimiter(
      { windowMs: 60_000, max: 1, validate: false },
      'route-b',
    );
    expect(factory).toHaveBeenCalledWith('route-b');
  });

  it('drops cached limiters when the store changes', async () => {
    const first = jest.fn(() => fakeStore());
    configureRateLimitStore(first);
    await createRateLimiter({ windowMs: 1000, max: 1, validate: false }, 'k');

    const second = jest.fn(() => fakeStore());
    configureRateLimitStore(second);
    await createRateLimiter({ windowMs: 1000, max: 1, validate: false }, 'k');
    expect(second).toHaveBeenCalledTimes(1);
  });
});

function failingStore(message = 'Redis down') {
  return {
    init: jest.fn(),
    increment: jest.fn(async () => {
      throw new Error(message);
    }),
    decrement: jest.fn(),
    resetKey: jest.fn(),
    localKeys: false,
  };
}

function fakeRes() {
  const res = {
    headersSent: false,
    statusCode: 200,
    setHeader: jest.fn(),
    getHeader: jest.fn(),
    removeHeader: jest.fn(),
    once: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
  };
  res.status = jest.fn(code => {
    res.statusCode = code;
    return res;
  });
  return res;
}

function run(limiter, req) {
  return new Promise(resolve => {
    limiter(req, fakeRes(), error => resolve(error));
  });
}

describe('resolveRateLimiter route identity', () => {
  const strict = { max: 10, windowMs: 15 * 60_000 };

  afterEach(() => {
    configureRateLimitStore(null);
  });

  it('gives each route its own bucket when the numbers are identical', async () => {
    const factory = jest.fn(() => fakeStore());
    configureRateLimitStore(factory);

    const login = await resolveRateLimiter({ key: 'auth:login', ...strict });
    const register = await resolveRateLimiter({
      key: 'auth:register',
      ...strict,
    });

    expect(factory.mock.calls.map(call => call[0])).toEqual([
      'route:auth:login',
      'route:auth:register',
    ]);
    expect(login).not.toBe(register);
  });

  it('accepts a route identity supplied by the caller', async () => {
    const factory = jest.fn(() => fakeStore());
    configureRateLimitStore(factory);

    await resolveRateLimiter({ ...strict }, 'POST /api/auth/login');
    expect(factory).toHaveBeenCalledWith('route:POST /api/auth/login');
  });

  it('reuses one limiter per route so counters survive requests', async () => {
    const factory = jest.fn(() => fakeStore());
    configureRateLimitStore(factory);

    const first = await resolveRateLimiter({ key: 'auth:probe', ...strict });
    const second = await resolveRateLimiter({ key: 'auth:probe', ...strict });

    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('warns when two identity-less routes land on one bucket', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const factory = jest.fn(() => fakeStore());
    configureRateLimitStore(factory);

    await resolveRateLimiter({ max: 7, windowMs: 1234 });
    await resolveRateLimiter({ max: 7, windowMs: 1234 });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('share one bucket'),
    );
    warn.mockRestore();
  });
});

describe('rate limiter store outage', () => {
  const config = {
    windowMs: 60_000,
    max: 2,
    validate: false,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: () => 'client',
    handler(_req, res) {
      res.status(429).json({ error: 'Too many requests' });
    },
  };

  afterEach(() => {
    configureRateLimitStore(null);
  });

  it('degrades to in-process counting instead of 500ing', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    configureRateLimitStore(() => failingStore());

    const limiter = await createRateLimiter(config, 'route:outage');
    const req = { ip: '203.0.113.7', headers: {} };

    // The shared store is down, but the request is served, not failed
    await expect(run(limiter, req)).resolves.toBeUndefined();
    await expect(run(limiter, req)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Shared rate-limit store unavailable'),
    );

    // ...and the limit is still enforced, per instance
    const res = fakeRes();
    const next = jest.fn();
    await new Promise(resolve => {
      res.json.mockImplementation(() => resolve());
      limiter(req, res, (...args) => {
        next(...args);
        resolve();
      });
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);

    error.mockRestore();
  });
});
