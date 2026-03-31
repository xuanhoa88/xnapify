/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v5 as uuidv5 } from 'uuid';

const NS = uuidv5.DNS;

// Seed permissions — deterministic UUIDs (stable across webpack bundles)
export const SEED_PERMISSIONS = Object.freeze({
  // Super admin
  superAdmin: uuidv5('xnapify.perm.superAdmin', NS),
  // Users CRUD + impersonate
  usersCreate: uuidv5('xnapify.perm.usersCreate', NS),
  usersRead: uuidv5('xnapify.perm.usersRead', NS),
  usersUpdate: uuidv5('xnapify.perm.usersUpdate', NS),
  usersDelete: uuidv5('xnapify.perm.usersDelete', NS),
  usersImpersonate: uuidv5('xnapify.perm.usersImpersonate', NS),
  // Roles CRUD
  rolesCreate: uuidv5('xnapify.perm.rolesCreate', NS),
  rolesRead: uuidv5('xnapify.perm.rolesRead', NS),
  rolesUpdate: uuidv5('xnapify.perm.rolesUpdate', NS),
  rolesDelete: uuidv5('xnapify.perm.rolesDelete', NS),
  // Groups CRUD
  groupsCreate: uuidv5('xnapify.perm.groupsCreate', NS),
  groupsRead: uuidv5('xnapify.perm.groupsRead', NS),
  groupsUpdate: uuidv5('xnapify.perm.groupsUpdate', NS),
  groupsDelete: uuidv5('xnapify.perm.groupsDelete', NS),
  // Permissions CRUD
  permissionsCreate: uuidv5('xnapify.perm.permissionsCreate', NS),
  permissionsRead: uuidv5('xnapify.perm.permissionsRead', NS),
  permissionsUpdate: uuidv5('xnapify.perm.permissionsUpdate', NS),
  permissionsDelete: uuidv5('xnapify.perm.permissionsDelete', NS),
  // Node-RED
  nodeRedAdmin: uuidv5('xnapify.perm.nodeRedAdmin', NS),
  nodeRedReadOnly: uuidv5('xnapify.perm.nodeRedReadOnly', NS),
  // API Keys
  apiKeysCreate: uuidv5('xnapify.perm.apiKeysCreate', NS),
  apiKeysRead: uuidv5('xnapify.perm.apiKeysRead', NS),
  apiKeysDelete: uuidv5('xnapify.perm.apiKeysDelete', NS),
  // Files CRUD
  filesCreate: uuidv5('xnapify.perm.filesCreate', NS),
  filesRead: uuidv5('xnapify.perm.filesRead', NS),
  filesUpdate: uuidv5('xnapify.perm.filesUpdate', NS),
  filesDelete: uuidv5('xnapify.perm.filesDelete', NS),
  // Activities (read only)
  activitiesRead: uuidv5('xnapify.perm.activitiesRead', NS),
  // Extensions CRUD
  extensionsCreate: uuidv5('xnapify.perm.extensionsCreate', NS),
  extensionsRead: uuidv5('xnapify.perm.extensionsRead', NS),
  extensionsUpdate: uuidv5('xnapify.perm.extensionsUpdate', NS),
  extensionsDelete: uuidv5('xnapify.perm.extensionsDelete', NS),
  // Email templates CRUD
  emailTemplatesCreate: uuidv5('xnapify.perm.emailTemplatesCreate', NS),
  emailTemplatesRead: uuidv5('xnapify.perm.emailTemplatesRead', NS),
  emailTemplatesUpdate: uuidv5('xnapify.perm.emailTemplatesUpdate', NS),
  emailTemplatesDelete: uuidv5('xnapify.perm.emailTemplatesDelete', NS),
});
