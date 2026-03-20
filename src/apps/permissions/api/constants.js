/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// Seed roles
export const SEED_PERMISSIONS = Object.freeze({
  // Super admin
  superAdmin: uuidv4(),
  // Users CRUD + impersonate
  usersCreate: uuidv4(),
  usersRead: uuidv4(),
  usersUpdate: uuidv4(),
  usersDelete: uuidv4(),
  usersImpersonate: uuidv4(),
  // Roles CRUD
  rolesCreate: uuidv4(),
  rolesRead: uuidv4(),
  rolesUpdate: uuidv4(),
  rolesDelete: uuidv4(),
  // Groups CRUD
  groupsCreate: uuidv4(),
  groupsRead: uuidv4(),
  groupsUpdate: uuidv4(),
  groupsDelete: uuidv4(),
  // Permissions CRUD
  permissionsCreate: uuidv4(),
  permissionsRead: uuidv4(),
  permissionsUpdate: uuidv4(),
  permissionsDelete: uuidv4(),
  // Node-RED
  nodeRedAdmin: uuidv4(),
  nodeRedReadOnly: uuidv4(),
  // API Keys
  apiKeysCreate: uuidv4(),
  apiKeysRead: uuidv4(),
  apiKeysDelete: uuidv4(),
  // Files CRUD
  filesCreate: uuidv4(),
  filesRead: uuidv4(),
  filesUpdate: uuidv4(),
  filesDelete: uuidv4(),
  // Activities (read only)
  activitiesRead: uuidv4(),
  // Plugins CRUD
  extensionsCreate: uuidv4(),
  extensionsRead: uuidv4(),
  extensionsUpdate: uuidv4(),
  extensionsDelete: uuidv4(),
  // Email templates CRUD
  emailTemplatesCreate: uuidv4(),
  emailTemplatesRead: uuidv4(),
  emailTemplatesUpdate: uuidv4(),
  emailTemplatesDelete: uuidv4(),
});
