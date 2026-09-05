/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { configureRateLimitStore, createRateLimiter } from './rateLimit.js';

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
