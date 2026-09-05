/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import Hook from './Hook.js';

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

  test('clears hooks for a specific extension', async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn(); // Registered by another extension
    const cb3 = jest.fn(); // Registered by same extension but different hook

    hooks.register('p.hook1', cb1, 'extension-a');
    hooks.register('p.hook1', cb2, 'extension-b');
    hooks.register('p.hook2', cb3, 'extension-a');

    hooks.clear('extension-a');

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
    const results = await hooks.executeParallel('async.hook');
    const duration = Date.now() - start;

    expect(results).toEqual([1, 2]);
    // running in parallel should take roughly 50ms, giving 100ms tolerance for slow CI boxes
    // execution sequentially takes 100ms
    expect(duration).toBeLessThan(190);
  });
});

describe('Hook error semantics', () => {
  let hooks;

  beforeEach(() => {
    hooks = new Hook();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('executeParallel swallows a SYNCHRONOUS throw like an async one', async () => {
    // Regression: Promise.resolve(callback()) invoked the callback before the
    // promise wrapper existed, so a sync throw escaped the catch and rejected
    // the whole batch while an async rejection was quietly dropped.
    hooks.register('h', () => {
      throw new Error('sync boom');
    });
    hooks.register('h', () => 'survivor');

    await expect(hooks.executeParallel('h')).resolves.toEqual(['survivor']);
  });

  test('execute and executeParallel agree on a failing handler', async () => {
    hooks.register('h', async () => {
      throw new Error('async boom');
    });
    hooks.register('h', () => {
      throw new Error('sync boom');
    });

    await expect(hooks.execute('h')).resolves.toEqual([]);
    await expect(hooks.executeParallel('h')).resolves.toEqual([]);
  });
});

describe('Hook.invoke (single-answer)', () => {
  let hooks;

  beforeEach(() => {
    hooks = new Hook();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('reports handled:false when nothing is registered', async () => {
    await expect(hooks.invoke('missing')).resolves.toEqual({
      handled: false,
      value: undefined,
      extensionId: undefined,
    });
  });

  test('returns the answer and the answering extension', async () => {
    hooks.register('h', (a, b) => a + b, 'ext-a');
    await expect(hooks.invoke('h', 2, 3)).resolves.toEqual({
      handled: true,
      value: 5,
      extensionId: 'ext-a',
    });
  });

  test('distinguishes an undefined answer from no handler', async () => {
    hooks.register('h', () => undefined, 'ext-a');
    const result = await hooks.invoke('h');
    expect(result.handled).toBe(true);
    expect(result.value).toBeUndefined();
  });

  test('propagates the handler error instead of swallowing it', async () => {
    const failure = new Error('handler exploded');
    failure.status = 418;
    hooks.register(
      'h',
      async () => {
        throw failure;
      },
      'ext-a',
    );

    await expect(hooks.invoke('h')).rejects.toBe(failure);
  });

  test('propagates a synchronous throw too', async () => {
    hooks.register(
      'h',
      () => {
        throw new Error('sync');
      },
      'ext-a',
    );
    await expect(hooks.invoke('h')).rejects.toThrow('sync');
  });

  test('warns and uses the highest-priority handler when several answer', async () => {
    hooks.register('h', () => 'from-a', 'ext-a', { priority: 10 });
    hooks.register('h', () => 'from-b', 'ext-b', { priority: 1 });

    const result = await hooks.invoke('h');
    expect(result.value).toBe('from-b');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('single-answer'),
    );
  });
});

describe('Hook public metadata scoping', () => {
  let hooks;

  beforeEach(() => {
    hooks = new Hook();
  });

  test('is empty when nothing is registered', () => {
    expect(hooks.getMeta('h')).toEqual({});
  });

  test('is public only when every handler opted in', () => {
    hooks.register('h', () => 1, 'ext-a', { public: true });
    expect(hooks.getMeta('h').public).toBe(true);

    // A second extension that did NOT opt in must close the hook again,
    // otherwise one extension could expose another's handler to guests.
    hooks.register('h', () => 2, 'ext-b');
    expect(hooks.getMeta('h').public).toBe(false);
  });

  test('reopens once the private handler is unregistered', () => {
    const priv = () => 2;
    hooks.register('h', () => 1, 'ext-a', { public: true });
    hooks.register('h', priv, 'ext-b');
    expect(hooks.getMeta('h').public).toBe(false);

    hooks.unregister('h', priv);
    expect(hooks.getMeta('h').public).toBe(true);
  });
});
