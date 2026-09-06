/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Container from './Container.js';
import {
  CapabilityDeniedError,
  createCapabilityMatcher,
  createScopedContainer,
} from './scoped.js';

describe('createScopedContainer', () => {
  let container;

  beforeEach(() => {
    container = new Container();
    container.instance('db', { name: 'db' });
    container.instance('hook', { name: 'hook' });
    container.instance('users:sessions', { name: 'sessions' });
    container.instance('users:rbacCache', { name: 'rbac' });
  });

  it('resolves only granted bindings', () => {
    const scoped = createScopedContainer(container, ['hook'], {
      owner: 'ext-a',
    });

    expect(scoped.resolve('hook')).toEqual({ name: 'hook' });
    expect(() => scoped.resolve('db')).toThrow(CapabilityDeniedError);

    try {
      scoped.resolve('db');
    } catch (err) {
      expect(err.code).toBe('E_CAPABILITY_DENIED');
      expect(err.status).toBe(403);
      expect(err.capability).toBe('db');
      expect(err.owner).toBe('ext-a');
      expect(err.message).toContain('xnapify.capabilities');
    }
  });

  it('reports has() as false for undeclared bindings', () => {
    const scoped = createScopedContainer(container, ['hook']);
    expect(scoped.has('hook')).toBe(true);
    expect(scoped.has('db')).toBe(false);
    expect(scoped.has('missing')).toBe(false);
  });

  it('supports namespace wildcards and the global wildcard', () => {
    const ns = createScopedContainer(container, ['users:*']);
    expect(ns.resolve('users:sessions')).toEqual({ name: 'sessions' });
    expect(ns.resolve('users:rbacCache')).toEqual({ name: 'rbac' });
    expect(() => ns.resolve('db')).toThrow(CapabilityDeniedError);

    const all = createScopedContainer(container, ['*']);
    expect(all.resolve('db')).toEqual({ name: 'db' });
    expect(all.getBindingNames()).toEqual(
      expect.arrayContaining(['db', 'hook', 'users:sessions']),
    );
  });

  it('refuses denied bindings even under the global wildcard', () => {
    // '*' is what an extension manifest can ask for; the host's reserved
    // bindings must stay unreachable through it.
    const scoped = createScopedContainer(container, ['*', 'db'], {
      owner: 'ext-a',
      deny: ['db'],
    });

    expect(scoped.resolve('hook')).toEqual({ name: 'hook' });
    expect(() => scoped.resolve('db')).toThrow(CapabilityDeniedError);
    expect(scoped.has('db')).toBe(false);
    expect(scoped.getBindingNames()).not.toContain('db');
  });

  it('deny also outranks a namespace wildcard', () => {
    const allowed = createCapabilityMatcher(['users:*'], {
      deny: ['users:sessions'],
    });
    expect(allowed('users:rbacCache')).toBe(true);
    expect(allowed('users:sessions')).toBe(false);
  });

  it('exposes no mutation methods', () => {
    const scoped = createScopedContainer(container, ['*']);
    expect(scoped.bind).toBeUndefined();
    expect(scoped.instance).toBeUndefined();
    expect(scoped.reset).toBeUndefined();
    expect(scoped.cleanup).toBeUndefined();
    expect(Object.isFrozen(scoped)).toBe(true);
  });

  it('lists only granted binding names', () => {
    const scoped = createScopedContainer(container, ['hook', 'users:*']);
    expect(scoped.getBindingNames().sort()).toEqual([
      'hook',
      'users:rbacCache',
      'users:sessions',
    ]);
    expect(scoped.capabilities).toEqual(['hook', 'users:*']);
  });

  it('rejects invalid containers', () => {
    expect(() => createScopedContainer(null, [])).toThrow(TypeError);
  });

  it('matcher ignores blank and non-string entries', () => {
    const allowed = createCapabilityMatcher(['', '  ', 42, null, 'hook']);
    expect(allowed('hook')).toBe(true);
    expect(allowed('')).toBe(false);
    expect(allowed('db')).toBe(false);
  });
});
