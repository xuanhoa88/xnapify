/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

export const SEED_PERMISSIONS = Object.freeze({
  // Files CRUD
  filesCreate: uuidv4(),
  filesRead: uuidv4(),
  filesUpdate: uuidv4(),
  filesDelete: uuidv4(),
});
