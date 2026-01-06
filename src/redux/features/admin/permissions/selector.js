/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { normalizeState } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getOperationState = (state, operationKey) => {
  const normalized = normalizeState(
    state && state.admin && state.admin.permissions,
  );
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

const getPermissionsState = state => {
  const normalized = normalizeState(
    state && state.admin && state.admin.permissions,
  );
  return normalized.data;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

/**
 * Get all permissions
 */
export const getPermissions = state => {
  const data = getPermissionsState(state);
  return (data && data.permissions) || [];
};

/**
 * Get permissions pagination
 */
export const getPermissionsPagination = state => {
  const data = getPermissionsState(state);
  return (data && data.pagination) || null;
};

/**
 * Check if permissions list has been fetched at least once
 */
export const isPermissionsListInitialized = state => {
  const data = getPermissionsState(state);
  return !!(data && data.initialized && data.initialized.list);
};

/**
 * Check if single permission fetch has been completed at least once
 */
export const isPermissionFetchInitialized = state => {
  const data = getPermissionsState(state);
  return !!(data && data.initialized && data.initialized.fetch);
};

/**
 * Get the fetched permission (single permission fetched by ID)
 */
export const getFetchedPermission = state => {
  const data = getPermissionsState(state);
  return (data && data.fetchedPermission) || null;
};

/**
 * Get permission by ID
 */
export const getPermissionById = (state, id) => {
  const permissions = getPermissions(state);
  return permissions.find(permission => permission.id === id);
};

// =============================================================================
// LIST OPERATION (fetchPermissions)
// =============================================================================

export const isPermissionsListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getPermissionsListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// FETCH OPERATION (fetchPermissionById)
// =============================================================================

export const isPermissionFetchLoading = state => {
  const op = getOperationState(state, 'fetch');
  return !!(op && op.loading);
};

export const getPermissionFetchError = state => {
  const op = getOperationState(state, 'fetch');
  return (op && op.error) || null;
};

// =============================================================================
// CREATE OPERATION (createPermission)
// =============================================================================

export const isPermissionCreateLoading = state => {
  const op = getOperationState(state, 'create');
  return !!(op && op.loading);
};

export const getPermissionCreateError = state => {
  const op = getOperationState(state, 'create');
  return (op && op.error) || null;
};

// =============================================================================
// UPDATE OPERATION (updatePermission)
// =============================================================================

export const isPermissionUpdateLoading = state => {
  const op = getOperationState(state, 'update');
  return !!(op && op.loading);
};

export const getPermissionUpdateError = state => {
  const op = getOperationState(state, 'update');
  return (op && op.error) || null;
};

// =============================================================================
// BULK STATUS OPERATION (bulkUpdatePermissionStatus)
// =============================================================================

export const isPermissionBulkStatusLoading = state => {
  const op = getOperationState(state, 'bulkStatus');
  return !!(op && op.loading);
};

export const getPermissionBulkStatusError = state => {
  const op = getOperationState(state, 'bulkStatus');
  return (op && op.error) || null;
};

// =============================================================================
// BULK DELETE OPERATION (bulkDeletePermissions)
// =============================================================================

export const isPermissionBulkDeleteLoading = state => {
  const op = getOperationState(state, 'bulkDelete');
  return !!(op && op.loading);
};

export const getPermissionBulkDeleteError = state => {
  const op = getOperationState(state, 'bulkDelete');
  return (op && op.error) || null;
};
