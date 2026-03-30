/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Seed group ids
export const SEED_GROUPS = Object.freeze({
  engineering: uuidv4(),
  marketing: uuidv4(),
  support: uuidv4(),
  management: uuidv4(),
});
