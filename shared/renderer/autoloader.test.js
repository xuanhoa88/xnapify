/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { mergeAdapters } from './autoloader.js';

const makeAdapter = (files, lazy) => ({
  ...(lazy === undefined ? {} : { lazy }),
  files: () => files,
  load: path => path,
  resolve: path => path,
});

describe('mergeAdapters', () => {
  it('stays lazy when every module ships a lazy context', () => {
    const merged = mergeAdapters(
      new Map([
        ['users', makeAdapter(['./users/views/a/_route.js'], true)],
        ['roles', makeAdapter(['./roles/views/b/_route.js'], true)],
      ]),
    );

    expect(merged.lazy).toBe(true);
    expect(merged.files()).toHaveLength(2);
  });

  it('stays eager when no module ships a lazy context', () => {
    const merged = mergeAdapters(
      new Map([
        ['users', makeAdapter(['./users/views/a/_route.js'])],
        ['roles', makeAdapter(['./roles/views/b/_route.js'])],
      ]),
    );

    expect(merged.lazy).toBe(false);
  });

  it('names the offender when modules disagree, instead of downgrading', () => {
    // Taking the eager path over a lazy context stores each load() promise as
    // the module, and every route in the app then resolves to "no component".
    // A wiring mistake has to be loud.
    expect(() =>
      mergeAdapters(
        new Map([
          ['users', makeAdapter(['./users/views/a/_route.js'], true)],
          ['legacy', makeAdapter(['./legacy/views/b/_route.js'])],
        ]),
      ),
    ).toThrow(/legacy/);
  });

  it('returns null for an empty set', () => {
    expect(mergeAdapters(new Map())).toBeNull();
  });
});
