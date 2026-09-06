/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { isDeferrableExtension } from './deferral.js';

const slotOnly = overrides => ({
  hasRoutes: false,
  hasClientScript: true,
  slots: ['auth.login.quickAccess'],
  ...overrides,
});

describe('isDeferrableExtension', () => {
  it('defers a slot-only extension', () => {
    expect(isDeferrableExtension(slotOnly())).toBe(true);
  });

  it('never defers an extension that contributes navigation', () => {
    // The sidebar is on every page, so a menu-contributing extension cannot
    // wait for one of its slots to be rendered.
    expect(isDeferrableExtension(slotOnly({ hasMenus: true }))).toBe(false);
  });

  it('never defers a route provider or a wildcard subscriber', () => {
    expect(isDeferrableExtension(slotOnly({ hasRoutes: true }))).toBe(false);
    expect(isDeferrableExtension(slotOnly({ slots: ['*'] }))).toBe(false);
  });

  it('loads eagerly without the server verdict, or with no slots', () => {
    expect(isDeferrableExtension({ slots: ['x'] })).toBe(false);
    expect(isDeferrableExtension(slotOnly({ slots: [] }))).toBe(false);
    expect(isDeferrableExtension(null)).toBe(false);
  });
});
