/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Whether an extension's browser bundle can wait until one of its view
 * namespaces activates, instead of loading on every page.
 *
 * Only slot-only extensions qualify:
 * - an extension that contributes routes must be present before hydration;
 * - an extension that contributes navigation must run on every page, because
 *   the sidebar is on every page — waiting for one of its slots would leave
 *   its menu entry missing until the user happened to open a page rendering
 *   that slot;
 * - a wildcard (`*`) subscriber is needed everywhere;
 * - without the server's `hasRoutes` verdict the extension loads eagerly,
 *   which is the safe default.
 *
 * Shared by the server (which decides whether to emit `<script>`/`<link>`
 * tags and Early Hints for the extension) and the client manager (which
 * fetches the bundle when the namespace is first activated).
 *
 * @param {Object|null|undefined} manifest - Extension manifest
 * @returns {boolean}
 */
export function isDeferrableExtension(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (manifest.hasRoutes !== false) return false;
  if (manifest.hasMenus === true) return false;
  if (manifest.hasClientScript === false) return false;
  const slots = Array.isArray(manifest.slots) ? manifest.slots : [];
  return slots.length > 0 && !slots.includes('*');
}

export default isDeferrableExtension;
