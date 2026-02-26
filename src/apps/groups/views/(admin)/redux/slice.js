/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import {
  fetchGroups,
  fetchGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  assignRolesToGroup,
  fetchGroupPermissions,
} from './thunks';

/**
 * Groups Slice
 *
 * Manages groups state with per-operation loading/error tracking.
 *
 * State shape:
 * {
 *   data: {
 *     groups: [...],
 *     pagination: { total, page, limit, pages } | null,
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
  assignRoles: createOperationState(),
  fetchPermissions: createOperationState(),
});

/**
 * Create fresh data object
 */
const createFreshData = () => ({
  groups: [],
  pagination: null,
  fetchedGroup: null,
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

  // Legacy state with 'items' at root level
  if ('items' in state) {
    return {
      data: {
        groups: state.items || [],
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
export const SLICE_NAME = '@admin/groups';

const groupsSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearGroupsListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearGroupsFetchError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
      Object.assign(state, normalized);
    },
    clearGroupsCreateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.create.error = null;
      Object.assign(state, normalized);
    },
    clearGroupsUpdateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.update.error = null;
      Object.assign(state, normalized);
    },
    clearGroupsDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.delete.error = null;
      Object.assign(state, normalized);
    },
    resetGroupsState: () => initialState,
  },
  extraReducers: builder => {
    // =========================================================================
    // FETCH GROUPS LIST (list operation)
    // =========================================================================
    builder
      .addCase(fetchGroups.pending, createPendingHandler('list'))
      .addCase(fetchGroups.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.groups = action.payload.groups || [];
        normalized.data.pagination = action.payload.pagination || null;
        normalized.data.initialized.list = true;
        normalized.operations.list = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchGroups.rejected, createRejectedHandler('list'));

    // =========================================================================
    // FETCH GROUP BY ID (fetch operation)
    // =========================================================================
    builder
      .addCase(fetchGroupById.pending, (state, _action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedGroup = null;
        normalized.data.initialized.fetch = false;
        normalized.operations.fetch = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchGroupById.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedGroup = action.payload;
        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchGroupById.rejected, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedGroup = null;
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
    // CREATE GROUP (create operation)
    // =========================================================================
    builder
      .addCase(createGroup.pending, createPendingHandler('create'))
      .addCase(createGroup.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.groups.push(action.payload);
        normalized.operations.create = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(createGroup.rejected, createRejectedHandler('create'));

    // =========================================================================
    // UPDATE GROUP (update operation)
    // =========================================================================
    builder
      .addCase(updateGroup.pending, createPendingHandler('update'))
      .addCase(updateGroup.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const index = normalized.data.groups.findIndex(
          group => group.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.groups[index] = action.payload;
        }
        normalized.operations.update = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updateGroup.rejected, createRejectedHandler('update'));

    // =========================================================================
    // DELETE GROUP (delete operation)
    // =========================================================================
    builder
      .addCase(deleteGroup.pending, createPendingHandler('delete'))
      .addCase(deleteGroup.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.groups = normalized.data.groups.filter(
          group => group.id !== action.payload,
        );
        normalized.operations.delete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(deleteGroup.rejected, createRejectedHandler('delete'));

    // =========================================================================
    // ASSIGN ROLES TO GROUP (assignRoles operation)
    // =========================================================================
    builder
      .addCase(assignRolesToGroup.pending, createPendingHandler('assignRoles'))
      .addCase(
        assignRolesToGroup.fulfilled,
        createFulfilledHandler('assignRoles'),
      )
      .addCase(
        assignRolesToGroup.rejected,
        createRejectedHandler('assignRoles'),
      );

    // =========================================================================
    // FETCH GROUP PERMISSIONS (fetchPermissions operation)
    // =========================================================================
    builder
      .addCase(
        fetchGroupPermissions.pending,
        createPendingHandler('fetchPermissions'),
      )
      .addCase(
        fetchGroupPermissions.fulfilled,
        createFulfilledHandler('fetchPermissions'),
      )
      .addCase(
        fetchGroupPermissions.rejected,
        createRejectedHandler('fetchPermissions'),
      );
  },
});

export const {
  clearGroupsListError,
  clearGroupsFetchError,
  clearGroupsCreateError,
  clearGroupsUpdateError,
  clearGroupsDeleteError,
  resetGroupsState,
} = groupsSlice.actions;

export default groupsSlice.reducer;
