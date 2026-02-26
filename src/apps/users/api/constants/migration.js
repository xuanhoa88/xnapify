/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Store user IDs for use in other seeds
export const SEED_USERS = Object.freeze({
  admin: uuidv4(),
  'john.doe': uuidv4(),
  'jane.smith': uuidv4(),
  'locked.user': uuidv4(),
});
