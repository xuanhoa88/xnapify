/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { normalizeState, SLICE_NAME } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely get nested property from state
 * Updated to use new state path: state.adminUsers (instead of state.admin.users)
 */
const getOperationState = (state, operationKey) => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

/**
 * Get users data from state (handles all formats)
 */
const getUsersState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

/**
 * Get permissions state
 */
const getPermissionsState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.permissions;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

/**
 * Get all users
 */
export const getUsers = state => {
  const data = getUsersState(state);
  return (data && data.users) || [];
};

/**
 * Get users pagination
 */
export const getUsersPagination = state => {
  const data = getUsersState(state);
  return (data && data.pagination) || null;
};

/**
 * Check if users list has been fetched at least once
 */
export const isUsersListInitialized = state => {
  const data = getUsersState(state);
  return !!(data && data.initialized && data.initialized.list);
};

/**
 * Check if single user fetch has been completed at least once
 */
export const isUserFetchInitialized = state => {
  const data = getUsersState(state);
  return !!(data && data.initialized && data.initialized.fetch);
};

/**
 * Get the fetched user (single user fetched by ID)
 */
export const getFetchedUser = state => {
  const data = getUsersState(state);
  return (data && data.fetchedUser) || null;
};

/**
 * Get user by ID
 */
export const getUserById = (state, id) => {
  const users = getUsers(state);
  return users.find(user => user.id === id);
};

/**
 * Get user permissions items
 */
export const getUserPermissions = state => {
  const permissions = getPermissionsState(state);
  return (permissions && permissions.items) || [];
};

/**
 * Get user permissions userId
 */
export const getUserPermissionsUserId = state => {
  const permissions = getPermissionsState(state);
  return (permissions && permissions.userId) || null;
};

// =============================================================================
// LIST OPERATION (fetchUsers)
// =============================================================================

export const isUsersListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getUsersListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// FETCH OPERATION (fetchUserById)
// =============================================================================

export const isUserFetchLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getUserFetchError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};

// =============================================================================
// CREATE OPERATION (createUser)
// =============================================================================

export const isUserCreateLoading = state => {
  const op = getOperationState(state, 'create');
  return !!(op && op.loading);
};

export const getUserCreateError = state => {
  const op = getOperationState(state, 'create');
  return (op && op.error) || null;
};

// =============================================================================
// UPDATE OPERATION (updateUser)
// =============================================================================

export const isUserUpdateLoading = state => {
  const op = getOperationState(state, 'update');
  return !!(op && op.loading);
};

export const getUserUpdateError = state => {
  const op = getOperationState(state, 'update');
  return (op && op.error) || null;
};

// =============================================================================
// BULK STATUS OPERATION (bulkUpdateUserStatus)
// =============================================================================

export const isUserBulkStatusLoading = state => {
  const op = getOperationState(state, 'bulkStatus');
  return !!(op && op.loading);
};

export const getUserBulkStatusError = state => {
  const op = getOperationState(state, 'bulkStatus');
  return (op && op.error) || null;
};

// =============================================================================
// BULK DELETE OPERATION (bulkDeleteUsers)
// =============================================================================

export const isUserBulkDeleteLoading = state => {
  const op = getOperationState(state, 'bulkDelete');
  return !!(op && op.loading);
};

export const getUserBulkDeleteError = state => {
  const op = getOperationState(state, 'bulkDelete');
  return (op && op.error) || null;
};

// =============================================================================
// USER PERMISSIONS OPERATION (fetchUserPermissions)
// =============================================================================

export const isUserPermissionsOperationLoading = state => {
  const op = getOperationState(state, 'permissions');
  return !!(op && op.loading);
};

export const getUserPermissionsOperationError = state => {
  const op = getOperationState(state, 'permissions');
  return (op && op.error) || null;
};

// =============================================================================
// ASSIGN ROLES OPERATION (assignRolesToUser)
// =============================================================================

export const isUserAssignRolesLoading = state => {
  const op = getOperationState(state, 'assignRoles');
  return !!(op && op.loading);
};

export const getUserAssignRolesError = state => {
  const op = getOperationState(state, 'assignRoles');
  return (op && op.error) || null;
};

// =============================================================================
// ASSIGN GROUPS OPERATION (assignGroupsToUser)
// =============================================================================

export const isUserAssignGroupsLoading = state => {
  const op = getOperationState(state, 'assignGroups');
  return !!(op && op.loading);
};

export const getUserAssignGroupsError = state => {
  const op = getOperationState(state, 'assignGroups');
  return (op && op.error) || null;
};
