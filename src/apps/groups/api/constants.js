/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v5 as uuidv5 } from 'uuid';

const NS = uuidv5.DNS;

// Seed group ids — deterministic UUIDs (stable across webpack bundles)
export const SEED_GROUPS = Object.freeze({
  engineering: uuidv5('xnapify.group.engineering', NS),
  marketing: uuidv5('xnapify.group.marketing', NS),
  support: uuidv5('xnapify.group.support', NS),
  management: uuidv5('xnapify.group.management', NS),
});
