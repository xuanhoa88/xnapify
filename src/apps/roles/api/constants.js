/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v5 as uuidv5 } from 'uuid';

// Stable namespace for deterministic seed UUIDs.
// Using the DNS namespace ensures the same ID across all webpack bundles.
const NS = uuidv5.DNS;

// Seed roles — deterministic UUIDs derived from role names.
// Must be stable across bundles (server.js + extension api.js).
export const SEED_ROLES = Object.freeze({
  admin: uuidv5('xnapify.role.admin', NS),
  user: uuidv5('xnapify.role.user', NS),
  mod: uuidv5('xnapify.role.mod', NS),
  editor: uuidv5('xnapify.role.editor', NS),
  viewer: uuidv5('xnapify.role.viewer', NS),
});
