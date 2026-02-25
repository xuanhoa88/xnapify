/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Seed roles
export const SEED_ROLES = Object.freeze({
  admin: uuidv4(),
  user: uuidv4(),
  mod: uuidv4(),
  editor: uuidv4(),
  viewer: uuidv4(),
});
