/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  registerResourceContext,
  activateLocale,
  getActiveLocales,
  resetResourceRegistry,
} from './resources.js';
import { addNamespace } from './utils.js';

jest.mock('./utils.js', () => ({ addNamespace: jest.fn(() => true) }));

/**
 * Stands in for a `mode: 'lazy'` webpack context: keys are known without
 * loading, and load() returns a promise.
 */
function createLazyContext(files) {
  const loaded = [];
  const ctx = path => {
    loaded.push(path);
    return Promise.resolve({ default: files[path] });
  };
  ctx.keys = () => Object.keys(files);
  ctx.resolve = path => path;
  ctx.loaded = loaded;
  return ctx;
}

const DICTS = {
  './en-US.json': { greeting: 'Hello' },
  './vi-VN.json': { greeting: 'Xin chào' },
};

describe('i18n resource registry', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    addNamespace.mockClear();
    resetResourceRegistry();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('in the browser', () => {
    beforeEach(() => {
      global.window = {};
      resetResourceRegistry();
    });

    it('loads only the default locale when nothing has been activated', async () => {
      const ctx = createLazyContext(DICTS);
      await registerResourceContext('users', ctx);

      expect(ctx.loaded).toEqual(['./en-US.json']);
      expect(addNamespace).toHaveBeenCalledWith('users', {
        'en-US': { greeting: 'Hello' },
      });
    });

    it('loads the other locale only when it is activated', async () => {
      const ctx = createLazyContext(DICTS);
      await registerResourceContext('users', ctx);
      expect(ctx.loaded).toEqual(['./en-US.json']);

      await activateLocale('vi-VN');

      expect(ctx.loaded).toEqual(['./en-US.json', './vi-VN.json']);
      expect(addNamespace).toHaveBeenLastCalledWith('users', {
        'vi-VN': { greeting: 'Xin chào' },
      });
      expect(getActiveLocales()).toEqual(
        expect.arrayContaining(['en-US', 'vi-VN']),
      );
    });

    it('gives a module registered later every active locale', async () => {
      await activateLocale('vi-VN');

      const late = createLazyContext(DICTS);
      await registerResourceContext('files', late);

      expect(late.loaded.sort()).toEqual(['./en-US.json', './vi-VN.json']);
    });

    it('loads each locale at most once', async () => {
      const ctx = createLazyContext(DICTS);
      await registerResourceContext('users', ctx);
      await activateLocale('vi-VN');
      await activateLocale('vi-VN');
      await activateLocale('en-US');

      expect(ctx.loaded).toEqual(['./en-US.json', './vi-VN.json']);
    });

    it('survives a dictionary that fails to load', async () => {
      const ctx = path => Promise.reject(new Error('chunk gone: ' + path));
      ctx.keys = () => ['./en-US.json'];
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        registerResourceContext('broken', ctx),
      ).resolves.toBeUndefined();
      expect(addNamespace).not.toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('on the server', () => {
    beforeEach(() => {
      delete global.window;
      resetResourceRegistry();
    });

    it('loads every locale, because one store serves all requests', async () => {
      const ctx = createLazyContext(DICTS);
      await registerResourceContext('users', ctx);

      expect(ctx.loaded.sort()).toEqual(['./en-US.json', './vi-VN.json']);
      expect(addNamespace).toHaveBeenCalledTimes(2);
    });

    it('does not record a request locale in process-global state', async () => {
      // One process serves every request, so the language belongs to the
      // request. A locale written into the module-level active set by the
      // request rendering in it would still be there for the next one.
      const ctx = createLazyContext(DICTS);
      await registerResourceContext('users', ctx);

      await activateLocale('fr-FR');

      expect(getActiveLocales().sort()).toEqual(['en-US', 'vi-VN']);
    });

    it('reports what the registered contexts provide, not what was asked for', async () => {
      // Before any module registers, the only thing the server can promise is
      // the fallback locale — never a language some earlier request chose.
      await activateLocale('vi-VN');
      expect(getActiveLocales()).toEqual(['en-US']);
    });

    it('activating a locale loads nothing new, since boot loaded it all', async () => {
      const ctx = createLazyContext(DICTS);
      await registerResourceContext('users', ctx);
      const afterBoot = ctx.loaded.length;

      await activateLocale('vi-VN');

      expect(ctx.loaded.length).toBe(afterBoot);
    });
  });
});

describe('repeated registration', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    addNamespace.mockClear();
    resetResourceRegistry();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('keeps one entry per namespace when discovery re-runs', async () => {
    // The server re-runs module discovery on every route-tree invalidation
    // (extension install, uninstall, refresh, HMR) and registers the same
    // namespaces again. Appending would grow the registry without bound and
    // make activateLocale — dispatched on every SSR request — walk a longer
    // list each time.
    const ctx = createLazyContext(DICTS);

    await registerResourceContext('users', ctx);
    const afterFirst = ctx.loaded.length;
    await registerResourceContext('users', ctx);
    await registerResourceContext('users', ctx);

    expect(ctx.loaded.length).toBe(afterFirst);

    // And activating a locale walks one entry, not one per registration:
    // duplicates would each re-resolve the same dictionary.
    await activateLocale('vi-VN');
    expect(ctx.loaded.length).toBe(afterFirst);
  });

  it('re-reads dictionaries when a namespace is rebuilt with a new context', async () => {
    await registerResourceContext('posts', createLazyContext(DICTS));
    addNamespace.mockClear();

    // An extension rebuilt at runtime hands over a different context object.
    const replacement = createLazyContext(DICTS);
    await registerResourceContext('posts', replacement);

    expect(replacement.loaded.length).toBeGreaterThan(0);
  });

  it('re-reads when the same context object gains a locale', async () => {
    // Object identity is an assumption about the bundler, not a guarantee the
    // registry can make: the file list a context describes is checked too, so
    // a context that grew a dictionary is picked up even when it is the very
    // same object.
    global.window = {};

    const files = { './en-US.json': { greeting: 'Hello' } };
    const ctx = createLazyContext(files);
    await registerResourceContext('posts', ctx);
    expect(ctx.loaded).toEqual(['./en-US.json']);

    files['./vi-VN.json'] = { greeting: 'Xin chào' };
    await activateLocale('vi-VN');
    // The old entry's adapter cached the original key list, so the new file is
    // invisible until the context is registered again.
    expect(ctx.loaded).toEqual(['./en-US.json']);

    // Registering again notices the changed file list and replaces the entry,
    // which re-reads the namespace from scratch — including the new locale.
    await registerResourceContext('posts', ctx);
    expect(ctx.loaded).toContain('./vi-VN.json');
  });
});
