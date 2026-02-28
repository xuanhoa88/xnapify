/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-env jest */

import Hook from './Hook';

describe('Hook', () => {
  let hooks;

  beforeEach(() => {
    hooks = new Hook();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('registers and executes hooks', async () => {
    const callback = jest.fn().mockImplementation(x => x * 2);
    hooks.register('test.hook', callback);

    const results = await hooks.execute('test.hook', 10);
    expect(callback).toHaveBeenCalledWith(10);
    expect(results).toEqual([20]);
  });

  test('handles multiple callbacks for same hook', async () => {
    const cb1 = jest.fn().mockReturnValue(1);
    const cb2 = jest.fn().mockReturnValue(2);

    hooks.register('multi.hook', cb1);
    hooks.register('multi.hook', cb2);

    const results = await hooks.execute('multi.hook');
    expect(results).toEqual([1, 2]);
  });

  test('prevents duplicate callback registration', () => {
    const callback = () => {};
    hooks.register('dup.hook', callback);
    hooks.register('dup.hook', callback);

    // Internal checks via spy
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate callback registration'),
    );

    const cbSpy = jest.fn();
    hooks.register('exec.dup', cbSpy);
    hooks.register('exec.dup', cbSpy);

    return hooks.execute('exec.dup').then(() => {
      expect(cbSpy).toHaveBeenCalledTimes(1);
    });
  });

  test('unregisters hooks', async () => {
    const callback = jest.fn();
    hooks.register('unreg.hook', callback);
    hooks.unregister('unreg.hook', callback);

    await hooks.execute('unreg.hook');
    expect(callback).not.toHaveBeenCalled();
  });

  test('clears hooks for a specific plugin', async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn(); // Registered by another plugin
    const cb3 = jest.fn(); // Registered by same plugin but different hook

    hooks.register('p.hook1', cb1, 'plugin-a');
    hooks.register('p.hook1', cb2, 'plugin-b');
    hooks.register('p.hook2', cb3, 'plugin-a');

    hooks.clear('plugin-a');

    await hooks.execute('p.hook1');
    await hooks.execute('p.hook2');

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
    expect(cb3).not.toHaveBeenCalled();
  });

  test('handles error in callback safely', async () => {
    const errorCb = jest.fn().mockRejectedValue(new Error('Fail'));
    const successCb = jest.fn().mockResolvedValue('OK');

    hooks.register('error.hook', errorCb);
    hooks.register('error.hook', successCb);

    const results = await hooks.execute('error.hook');

    expect(console.error).toHaveBeenCalled();
    expect(results).toEqual(['OK']); // Should contain only successful results
  });
  test('parallel execution reduces total time', async () => {
    const slow1 = jest.fn(() => new Promise(r => setTimeout(() => r(1), 50)));
    const slow2 = jest.fn(() => new Promise(r => setTimeout(() => r(2), 50)));
    hooks.register('async.hook', slow1);
    hooks.register('async.hook', slow2);

    const start = Date.now();
    const results = await hooks.execute('async.hook');
    const duration = Date.now() - start;

    expect(results).toEqual([1, 2]);
    // running in parallel should take slightly more than 50ms, not 100ms
    expect(duration).toBeLessThan(90);
  });
});
