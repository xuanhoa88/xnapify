/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v5 as uuidv5 } from 'uuid';

const NS = uuidv5.DNS;

// Seed user IDs — deterministic UUIDs (stable across webpack bundles)
export const SEED_USERS = Object.freeze({
  admin: uuidv5('xnapify.user.admin', NS),
  'john.doe': uuidv5('xnapify.user.john.doe', NS),
  'jane.smith': uuidv5('xnapify.user.jane.smith', NS),
  'locked.user': uuidv5('xnapify.user.locked.user', NS),
});
