/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import {
  fetchRoles,
  fetchRoleById,
  createRole,
  updateRole,
  deleteRole,
  fetchRolePermissions,
} from './thunks';

/**
 * Roles Slice
 *
 * Manages roles state with per-operation loading/error tracking.
 *
 * State shape:
 * {
 *   data: {
 *     roles: [...],
 *     pagination: { total, page, limit, ... } | null,
 *   },
 *   operations: {
 *     list: { loading: boolean, error: string | null },
 *     fetch: { loading: boolean, error: string | null },
 *     create: { loading: boolean, error: string | null },
 *     update: { loading: boolean, error: string | null },
 *     delete: { loading: boolean, error: string | null },
 *   }
 * }
 */

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create a fresh operations object with all operation states.
 */
const createFreshOperations = () => ({
  list: createOperationState(),
  fetch: createOperationState(),
  create: createOperationState(),
  update: createOperationState(),
  delete: createOperationState(),
  fetchPermissions: createOperationState(),
});

/**
 * Create fresh data object
 */
const createFreshData = () => ({
  roles: [],
  pagination: null,
  fetchedRole: null,
  initialized: {
    list: false,
    fetch: false,
  },
});

// Initial state with fresh operations
const initialState = {
  data: createFreshData(),
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 * Exported for reuse in selectors.
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

  // Legacy state with 'roles' at root level
  if ('roles' in state) {
    return {
      data: {
        roles: state.roles || [],
        pagination: state.pagination || null,
      },
      operations: createFreshOperations(),
    };
  }

  return { data: createFreshData(), operations: createFreshOperations() };
};

/**
 * Create pending handler for a specific operation
 */
const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

/**
 * Create rejected handler for a specific operation
 */
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

/**
 * Create fulfilled handler that clears operation loading state
 */
const createFulfilledHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = createOperationState();
  Object.assign(state, normalized);
};

/**
 * Slice name constant - used for reducer injection and selectors
 */
export const SLICE_NAME = '@admin/roles';

const rolesSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearRolesListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearRoleFetchError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
      Object.assign(state, normalized);
    },
    clearRoleCreateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.create.error = null;
      Object.assign(state, normalized);
    },
    clearRoleUpdateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.update.error = null;
      Object.assign(state, normalized);
    },
    clearRoleDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.delete.error = null;
      Object.assign(state, normalized);
    },
    resetRolesState: () => initialState,
  },
  extraReducers: builder => {
    // =========================================================================
    // FETCH ROLES LIST (list operation)
    // =========================================================================
    builder
      .addCase(fetchRoles.pending, createPendingHandler('list'))
      .addCase(fetchRoles.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.roles = action.payload.roles || [];
        normalized.data.pagination = action.payload.pagination || null;
        normalized.data.initialized.list = true;
        normalized.operations.list = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchRoles.rejected, createRejectedHandler('list'));

    // =========================================================================
    // FETCH ROLE BY ID (fetch operation)
    // =========================================================================
    builder
      .addCase(fetchRoleById.pending, (state, _action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedRole = null;
        normalized.data.initialized.fetch = false;
        normalized.operations.fetch = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchRoleById.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedRole = action.payload;
        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchRoleById.rejected, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedRole = null;
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

    // =========================================================================
    // CREATE ROLE (create operation)
    // =========================================================================
    builder
      .addCase(createRole.pending, createPendingHandler('create'))
      .addCase(createRole.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.roles.push(action.payload);
        normalized.operations.create = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(createRole.rejected, createRejectedHandler('create'));

    // =========================================================================
    // UPDATE ROLE (update operation)
    // =========================================================================
    builder
      .addCase(updateRole.pending, createPendingHandler('update'))
      .addCase(updateRole.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const index = normalized.data.roles.findIndex(
          role => role.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.roles[index] = action.payload;
        }
        normalized.operations.update = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updateRole.rejected, createRejectedHandler('update'));

    // =========================================================================
    // DELETE ROLE (delete operation)
    // =========================================================================
    builder
      .addCase(deleteRole.pending, createPendingHandler('delete'))
      .addCase(deleteRole.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.roles = normalized.data.roles.filter(
          role => role.id !== action.payload,
        );
        normalized.operations.delete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(deleteRole.rejected, createRejectedHandler('delete'));

    // =========================================================================
    // FETCH ROLE PERMISSIONS (fetchPermissions operation)
    // =========================================================================
    builder
      .addCase(
        fetchRolePermissions.pending,
        createPendingHandler('fetchPermissions'),
      )
      .addCase(
        fetchRolePermissions.fulfilled,
        createFulfilledHandler('fetchPermissions'),
      )
      .addCase(
        fetchRolePermissions.rejected,
        createRejectedHandler('fetchPermissions'),
      );
  },
});

export const {
  clearRolesListError,
  clearRoleFetchError,
  clearRoleCreateError,
  clearRoleUpdateError,
  clearRoleDeleteError,
  resetRolesState,
} = rolesSlice.actions;

export default rolesSlice.reducer;
