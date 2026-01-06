/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import {
  fetchPermissions,
  fetchPermissionById,
  createPermission,
  updatePermission,
  bulkUpdatePermissionStatus,
  bulkDeletePermissions,
} from './thunks';

/**
 * Permissions Slice
 *
 * Manages permissions state with per-operation loading/error tracking.
 */

const createOperationState = () => ({ loading: false, error: null });

const createFreshOperations = () => ({
  list: createOperationState(),
  fetch: createOperationState(),
  create: createOperationState(),
  update: createOperationState(),
  bulkStatus: createOperationState(),
  bulkDelete: createOperationState(),
});

const createFreshData = () => ({
  permissions: [],
  pagination: null,
  fetchedPermission: null,
  initialized: {
    list: false,
    fetch: false,
  },
});

const initialState = {
  data: createFreshData(),
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 */
export const normalizeState = state => {
  if (!state || typeof state !== 'object') {
    return { data: createFreshData(), operations: createFreshOperations() };
  }

  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  // Legacy state with 'permissions' at root level
  if ('permissions' in state && Array.isArray(state.permissions)) {
    return {
      data: {
        permissions: state.permissions || [],
        pagination: state.pagination || null,
      },
      operations: createFreshOperations(),
    };
  }

  return { data: createFreshData(), operations: createFreshOperations() };
};

const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

const createRejectedHandler = operationKey => (state, action) => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = {
    loading: false,
    error:
      action.payload ||
      (action.error && action.error.message) ||
      'An error occurred',
  };
  Object.assign(state, normalized);
};

const createFulfilledHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = createOperationState();
  Object.assign(state, normalized);
};

const permissionsSlice = createSlice({
  name: 'admin/permissions',
  initialState,
  reducers: {
    clearPermissionsListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearPermissionFetchError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
      Object.assign(state, normalized);
    },
    clearPermissionCreateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.create.error = null;
      Object.assign(state, normalized);
    },
    clearPermissionUpdateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.update.error = null;
      Object.assign(state, normalized);
    },
    clearPermissionBulkStatusError: state => {
      const normalized = normalizeState(state);
      normalized.operations.bulkStatus.error = null;
      Object.assign(state, normalized);
    },
    clearPermissionBulkDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.bulkDelete.error = null;
      Object.assign(state, normalized);
    },
    resetPermissionsState: () => initialState,
  },
  extraReducers: builder => {
    // FETCH PERMISSIONS LIST
    builder
      .addCase(fetchPermissions.pending, createPendingHandler('list'))
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.permissions = action.payload.permissions || [];
        normalized.data.pagination = action.payload.pagination || null;
        normalized.data.initialized.list = true;
        normalized.operations.list = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchPermissions.rejected, createRejectedHandler('list'));

    // FETCH PERMISSION BY ID
    builder
      .addCase(fetchPermissionById.pending, (state, _action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedPermission = null;
        normalized.data.initialized.fetch = false;
        normalized.operations.fetch = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchPermissionById.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedPermission = action.payload;
        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchPermissionById.rejected, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedPermission = null;
        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = {
          loading: false,
          error:
            action.payload ||
            (action.error && action.error.message) ||
            'An error occurred',
        };
        Object.assign(state, normalized);
      });

    // CREATE PERMISSION
    builder
      .addCase(createPermission.pending, createPendingHandler('create'))
      .addCase(createPermission.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.permissions.push(action.payload);
        normalized.operations.create = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(createPermission.rejected, createRejectedHandler('create'));

    // UPDATE PERMISSION
    builder
      .addCase(updatePermission.pending, createPendingHandler('update'))
      .addCase(updatePermission.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const index = normalized.data.permissions.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.permissions[index] = action.payload;
        }
        normalized.operations.update = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updatePermission.rejected, createRejectedHandler('update'));

    // BULK UPDATE STATUS
    builder
      .addCase(
        bulkUpdatePermissionStatus.pending,
        createPendingHandler('bulkStatus'),
      )
      .addCase(bulkUpdatePermissionStatus.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (action.payload.permissions) {
          action.payload.permissions.forEach(updated => {
            const index = normalized.data.permissions.findIndex(
              p => p.id === updated.id,
            );
            if (index !== -1) {
              normalized.data.permissions[index] = updated;
            }
          });
        }
        normalized.operations.bulkStatus = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        bulkUpdatePermissionStatus.rejected,
        createRejectedHandler('bulkStatus'),
      );

    // BULK DELETE
    builder
      .addCase(
        bulkDeletePermissions.pending,
        createPendingHandler('bulkDelete'),
      )
      .addCase(bulkDeletePermissions.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const deletedIds = action.payload.deletedIds || [];
        normalized.data.permissions = normalized.data.permissions.filter(
          p => !deletedIds.includes(p.id),
        );
        normalized.operations.bulkDelete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        bulkDeletePermissions.rejected,
        createRejectedHandler('bulkDelete'),
      );
  },
});

export const {
  clearPermissionsListError,
  clearPermissionFetchError,
  clearPermissionCreateError,
  clearPermissionUpdateError,
  clearPermissionBulkStatusError,
  clearPermissionBulkDeleteError,
  resetPermissionsState,
} = permissionsSlice.actions;

export default permissionsSlice.reducer;
