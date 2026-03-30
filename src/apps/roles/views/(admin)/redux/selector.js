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

const getRolesState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

/**
 * Get all roles
 */
export const getRoles = state => {
  const data = getRolesState(state);
  return (data && data.roles) || [];
};

/**
 * Get roles pagination
 */
export const getRolesPagination = state => {
  const data = getRolesState(state);
  return (data && data.pagination) || null;
};

/**
 * Check if roles list has been fetched at least once
 */
export const isRolesListInitialized = state => {
  const data = getRolesState(state);
  return !!(data && data.initialized && data.initialized.list);
};

/**
 * Check if single role fetch has been completed at least once
 */
export const isRoleFetchInitialized = state => {
  const data = getRolesState(state);
  return !!(data && data.initialized && data.initialized.fetch);
};

/**
 * Get the fetched role (single role fetched by ID)
 */
export const getFetchedRole = state => {
  const data = getRolesState(state);
  return (data && data.fetchedRole) || null;
};

/**
 * Get role by ID
 */
export const getRoleById = (state, id) => {
  const roles = getRoles(state);
  return roles.find(role => role.id === id);
};

/**
 * Get roles by array of IDs
 */
export const getRolesByIds = (state, ids) => {
  if (!ids || ids.length === 0) return [];
  const roles = getRoles(state);
  const idSet = new Set(ids);
  return roles.filter(role => idSet.has(role.id));
};

/**
 * Get all role names
 */
export const getRoleNames = state => {
  const roles = getRoles(state);
  return roles.map(role => role.name);
};

/**
 * Get role by name
 */
export const getRoleByName = (state, name) => {
  const roles = getRoles(state);
  return roles.find(role => role.name.toLowerCase() === name.toLowerCase());
};

/**
 * Get roles by array of names
 */
export const getRolesByNames = (state, names) => {
  if (!names || names.length === 0) return [];
  const roles = getRoles(state);
  const nameSet = new Set(names.map(n => n.toLowerCase()));
  return roles.filter(role => nameSet.has(role.name.toLowerCase()));
};

// =============================================================================
// LIST OPERATION (fetchRoles)
// =============================================================================

export const isRolesListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getRolesListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// FETCH OPERATION (fetchRoleById)
// =============================================================================

export const isRoleFetchLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getRoleFetchError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};

// =============================================================================
// CREATE OPERATION (createRole)
// =============================================================================

export const isRoleCreateLoading = state => {
  const op = getOperationState(state, 'create');
  return !!(op && op.loading);
};

export const getRoleCreateError = state => {
  const op = getOperationState(state, 'create');
  return (op && op.error) || null;
};

// =============================================================================
// UPDATE OPERATION (updateRole)
// =============================================================================

export const isRoleUpdateLoading = state => {
  const op = getOperationState(state, 'update');
  return !!(op && op.loading);
};

export const getRoleUpdateError = state => {
  const op = getOperationState(state, 'update');
  return (op && op.error) || null;
};

// =============================================================================
// DELETE OPERATION (deleteRole)
// =============================================================================

export const isRoleDeleteLoading = state => {
  const op = getOperationState(state, 'delete');
  return !!(op && op.loading);
};

export const getRoleDeleteError = state => {
  const op = getOperationState(state, 'delete');
  return (op && op.error) || null;
};

// =============================================================================
// FETCH PERMISSIONS OPERATION (fetchRolePermissions)
// =============================================================================

export const isRoleFetchPermissionsLoading = state => {
  const op = getOperationState(state, 'fetchPermissions');
  return !!(op && op.loading);
};

export const getRoleFetchPermissionsError = state => {
  const op = getOperationState(state, 'fetchPermissions');
  return (op && op.error) || null;
};
