/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v5 as uuidv5 } from 'uuid';

const NS = uuidv5.DNS;

// Seed file permissions — deterministic UUIDs (stable across webpack bundles)
export const SEED_PERMISSIONS = Object.freeze({
  filesCreate: uuidv5('xnapify.perm.filesCreate', NS),
  filesRead: uuidv5('xnapify.perm.filesRead', NS),
  filesUpdate: uuidv5('xnapify.perm.filesUpdate', NS),
  filesDelete: uuidv5('xnapify.perm.filesDelete', NS),
});
