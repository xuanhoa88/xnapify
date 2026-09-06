/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Handler, { DuplicateHandlerError } from './Handler.js';

describe('Handler registration', () => {
  let handlers;

  beforeEach(() => {
    handlers = new Handler();
  });

  test('rejects a non-function', () => {
    expect(() => handlers.register('h', 'nope', 'ext-a')).toThrow(TypeError);
  });

  test('registering the same callback twice is idempotent', () => {
    const fn = () => 1;
    handlers.register('h', fn, 'ext-a');
    expect(() => handlers.register('h', fn, 'ext-a')).not.toThrow();
    expect(handlers.idsFor('ext-a')).toEqual(['h']);
  });

  test('a competing registration fails loudly instead of losing silently', () => {
    handlers.register('h', () => 'a', 'ext-a');

    // Under the old collector store this quietly appended, and whichever
    // handler happened to sort first answered the caller.
    let caught;
    try {
      handlers.register('h', () => 'b', 'ext-b');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DuplicateHandlerError);
    expect(caught.code).toBe('E_DUPLICATE_HANDLER');
    expect(caught.status).toBe(409);
    expect(caught.ownerId).toBe('ext-a');
  });

  test('reports ownership', () => {
    handlers.register('h', () => 1, 'ext-a');
    expect(handlers.owns('ext-a', 'h')).toBe(true);
    expect(handlers.owns('ext-b', 'h')).toBe(false);
    expect(handlers.owns('ext-a', 'missing')).toBe(false);
  });

  test('unregister takes only the id and reports whether it removed anything', () => {
    handlers.register('h', () => 1, 'ext-a');
    expect(handlers.unregister('h')).toBe(true);
    expect(handlers.unregister('h')).toBe(false);
    expect(handlers.has('h')).toBe(false);
    expect(handlers.idsFor('ext-a')).toEqual([]);
  });

  test('the id is free again once released', () => {
    handlers.register('h', () => 'a', 'ext-a');
    handlers.unregister('h');
    expect(() => handlers.register('h', () => 'b', 'ext-b')).not.toThrow();
    expect(handlers.owns('ext-b', 'h')).toBe(true);
  });

  test('clear(extensionId) drops only that extension', () => {
    handlers.register('a', () => 1, 'ext-a');
    handlers.register('b', () => 2, 'ext-b');

    handlers.clear('ext-a');

    expect(handlers.has('a')).toBe(false);
    expect(handlers.has('b')).toBe(true);
  });

  test('clear() drops everything', () => {
    handlers.register('a', () => 1, 'ext-a');
    handlers.register('b', () => 2, 'ext-b');
    handlers.clear();
    expect(handlers.has('a')).toBe(false);
    expect(handlers.has('b')).toBe(false);
  });
});

describe('Handler metadata', () => {
  let handlers;

  beforeEach(() => {
    handlers = new Handler();
  });

  test('is empty when nothing is registered', () => {
    expect(handlers.getMeta('h')).toEqual({});
  });

  test('defaults to private', () => {
    handlers.register('h', () => 1, 'ext-a');
    expect(handlers.getMeta('h')).toEqual({ public: false });
  });

  test('records an explicit public opt-in', () => {
    handlers.register('h', () => 1, 'ext-a', { public: true });
    expect(handlers.getMeta('h')).toEqual({ public: true });
  });

  test('one extension cannot open another extension id', () => {
    // Single ownership makes this structurally impossible now: the second
    // registration is refused rather than merged into shared metadata.
    handlers.register('h', () => 1, 'ext-a');
    expect(() =>
      handlers.register('h', () => 2, 'ext-b', { public: true }),
    ).toThrow(DuplicateHandlerError);
    expect(handlers.getMeta('h').public).toBe(false);
  });
});

describe('Handler.invoke', () => {
  let handlers;

  beforeEach(() => {
    handlers = new Handler();
  });

  test('reports handled:false when nothing is registered', async () => {
    await expect(handlers.invoke('missing')).resolves.toEqual({
      handled: false,
      value: undefined,
      extensionId: undefined,
    });
  });

  test('returns the answer and the answering extension', async () => {
    handlers.register('h', (a, b) => a + b, 'ext-a');
    await expect(handlers.invoke('h', 2, 3)).resolves.toEqual({
      handled: true,
      value: 5,
      extensionId: 'ext-a',
    });
  });

  test('an undefined answer is still handled', async () => {
    handlers.register('h', () => undefined, 'ext-a');
    const result = await handlers.invoke('h');
    expect(result.handled).toBe(true);
    expect(result.value).toBeUndefined();
  });

  test('a falsy answer survives', async () => {
    handlers.register('h', () => 0, 'ext-a');
    await expect(handlers.invoke('h')).resolves.toMatchObject({ value: 0 });
  });

  test('propagates an async rejection instead of swallowing it', async () => {
    const failure = new Error('handler exploded');
    failure.status = 418;
    handlers.register(
      'h',
      async () => {
        throw failure;
      },
      'ext-a',
    );
    await expect(handlers.invoke('h')).rejects.toBe(failure);
  });

  test('propagates a synchronous throw too', async () => {
    handlers.register(
      'h',
      () => {
        throw new Error('sync');
      },
      'ext-a',
    );
    await expect(handlers.invoke('h')).rejects.toThrow('sync');
  });
});
