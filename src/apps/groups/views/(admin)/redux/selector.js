/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { normalizeState, SLICE_NAME } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getOperationState = (state, operationKey) => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

const getGroupsState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

/**
 * Get all groups
 */
export const getGroups = state => {
  const data = getGroupsState(state);
  return (data && data.groups) || [];
};

/**
 * Get groups pagination
 */
export const getGroupsPagination = state => {
  const data = getGroupsState(state);
  return (data && data.pagination) || null;
};

/**
 * Check if groups list has been fetched at least once
 */
export const isGroupsListInitialized = state => {
  const data = getGroupsState(state);
  return !!(data && data.initialized && data.initialized.list);
};

/**
 * Check if single group fetch has been completed at least once
 */
export const isGroupFetchInitialized = state => {
  const data = getGroupsState(state);
  return !!(data && data.initialized && data.initialized.fetch);
};

/**
 * Get the fetched group (single group fetched by ID)
 */
export const getFetchedGroup = state => {
  const data = getGroupsState(state);
  return (data && data.fetchedGroup) || null;
};

/**
 * Get group by ID
 */
export const getGroupById = (state, groupId) => {
  const groups = getGroups(state);
  return groups.find(group => group.id === groupId);
};

/**
 * Get roles for a specific group
 */
export const getGroupRoles = (state, groupId) => {
  const group = getGroupById(state, groupId);
  return (group && group.roles) || [];
};

/**
 * Get groups that have at least one role assigned
 */
export const getGroupsWithRoles = state => {
  const groups = getGroups(state);
  return groups.filter(group => group.roles && group.roles.length > 0);
};

/**
 * Get groups filtered by role name
 */
export const getGroupsByRoleName = (state, roleName) => {
  const groups = getGroups(state);
  return groups.filter(
    group =>
      group.roles &&
      group.roles.some(
        role => role.name.toLowerCase() === roleName.toLowerCase(),
      ),
  );
};

/**
 * Get total role count across all groups
 */
export const getTotalGroupRoleCount = state => {
  const groups = getGroups(state);
  return groups.reduce(
    (total, group) =>
      total +
      ((group &&
        (group.roleCount ||
          (Array.isArray(group.roles) ? group.roles.length : 0))) ||
        0),
    0,
  );
};

// =============================================================================
// LIST OPERATION (fetchGroups)
// =============================================================================

export const isGroupsListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getGroupsListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// FETCH OPERATION (fetchGroupById)
// =============================================================================

export const isGroupFetchLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getGroupFetchError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};

// =============================================================================
// CREATE OPERATION (createGroup)
// =============================================================================

export const isGroupCreateLoading = state => {
  const op = getOperationState(state, 'create');
  return !!(op && op.loading);
};

export const getGroupCreateError = state => {
  const op = getOperationState(state, 'create');
  return (op && op.error) || null;
};

// =============================================================================
// UPDATE OPERATION (updateGroup)
// =============================================================================

export const isGroupUpdateLoading = state => {
  const op = getOperationState(state, 'update');
  return !!(op && op.loading);
};

export const getGroupUpdateError = state => {
  const op = getOperationState(state, 'update');
  return (op && op.error) || null;
};

// =============================================================================
// DELETE OPERATION (deleteGroup)
// =============================================================================

export const isGroupDeleteLoading = state => {
  const op = getOperationState(state, 'delete');
  return !!(op && op.loading);
};

export const getGroupDeleteError = state => {
  const op = getOperationState(state, 'delete');
  return (op && op.error) || null;
};

// =============================================================================
// ASSIGN ROLES OPERATION (assignRolesToGroup)
// =============================================================================

export const isGroupAssignRolesLoading = state => {
  const op = getOperationState(state, 'assignRoles');
  return !!(op && op.loading);
};

export const getGroupAssignRolesError = state => {
  const op = getOperationState(state, 'assignRoles');
  return (op && op.error) || null;
};

// =============================================================================
// FETCH PERMISSIONS OPERATION (fetchGroupPermissions)
// =============================================================================

export const isGroupFetchPermissionsLoading = state => {
  const op = getOperationState(state, 'fetchPermissions');
  return !!(op && op.loading);
};

export const getGroupFetchPermissionsError = state => {
  const op = getOperationState(state, 'fetchPermissions');
  return (op && op.error) || null;
};
