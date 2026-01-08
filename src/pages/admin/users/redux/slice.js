/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import {
  fetchUsers,
  fetchUserById,
  createUser,
  updateUser,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  fetchUserPermissions,
  assignRolesToUser,
  assignGroupsToUser,
} from './thunks';

/**
 * Admin Users Slice
 *
 * Manages admin users list, CRUD operations, and user status updates
 * with per-operation loading/error tracking.
 *
 * State shape:
 * {
 *   data: {
 *     users: [...],
 *     pagination: { total, page, limit, ... } | null,
 *   },
 *   permissions: {
 *     userId: string | null,
 *     items: [...],
 *   },
 *   operations: {
 *     list: { loading: boolean, error: string | null },
 *     fetch: { loading: boolean, error: string | null },
 *     create: { loading: boolean, error: string | null },
 *     update: { loading: boolean, error: string | null },
 *     bulkStatus: { loading: boolean, error: string | null },
 *     bulkDelete: { loading: boolean, error: string | null },
 *     permissions: { loading: boolean, error: string | null },
 *   }
 * }
 */

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create a fresh operations object with all operation states.
 * This ensures we never return a reference to a frozen initialState.operations.
 */
const createFreshOperations = () => ({
  list: createOperationState(),
  fetch: createOperationState(),
  create: createOperationState(),
  update: createOperationState(),
  bulkStatus: createOperationState(),
  bulkDelete: createOperationState(),
  permissions: createOperationState(),
  assignRoles: createOperationState(),
  assignGroups: createOperationState(),
});

/**
 * Create fresh data object
 */
const createFreshData = () => ({
  users: [],
  pagination: null,
  fetchedUser: null, // Single user fetched by ID
  initialized: {
    list: false, // Tracks if list has been fetched at least once
    fetch: false, // Tracks if single item has been fetched at least once
  },
});

/**
 * Create fresh permissions object
 */
const createFreshPermissions = () => ({
  userId: null,
  items: [],
});

// Initial state with fresh operations
const initialState = {
  data: createFreshData(),
  permissions: createFreshPermissions(),
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 * This handles migration from old state format to new format.
 * Always clones operations to avoid SSR frozen state issues.
 * Exported for reuse in selectors.
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return {
      data: createFreshData(),
      permissions: createFreshPermissions(),
      operations: createFreshOperations(),
    };
  }

  // State already has proper structure - clone operations to ensure mutability
  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      permissions: state.permissions || createFreshPermissions(),
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  // Legacy state with 'users' at root level (old format)
  if ('users' in state) {
    return {
      data: {
        users: state.users || [],
        pagination: state.pagination || null,
      },
      permissions: state.permissions || createFreshPermissions(),
      operations: createFreshOperations(),
    };
  }

  // Very old format or unknown - return fresh state
  return {
    data: createFreshData(),
    permissions: createFreshPermissions(),
    operations: createFreshOperations(),
  };
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
export const SLICE_NAME = '@admin/users';

const usersSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    /**
     * Clear error for a specific operation
     */
    clearUsersListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearUserFetchError: state => {
      const normalized = normalizeState(state);
      normalized.operations.fetch.error = null;
      Object.assign(state, normalized);
    },
    clearUserCreateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.create.error = null;
      Object.assign(state, normalized);
    },
    clearUserUpdateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.update.error = null;
      Object.assign(state, normalized);
    },
    clearUserBulkStatusError: state => {
      const normalized = normalizeState(state);
      normalized.operations.bulkStatus.error = null;
      Object.assign(state, normalized);
    },
    clearUserBulkDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.bulkDelete.error = null;
      Object.assign(state, normalized);
    },
    clearUserPermissionsError: state => {
      const normalized = normalizeState(state);
      normalized.operations.permissions.error = null;
      Object.assign(state, normalized);
    },

    /**
     * Clear user permissions from state
     */
    clearUserPermissions: state => {
      const normalized = normalizeState(state);
      normalized.permissions = createFreshPermissions();
      Object.assign(state, normalized);
    },

    /**
     * Reset to initial state
     */
    resetUsersState: () => initialState,
  },
  extraReducers: builder => {
    // =========================================================================
    // FETCH USERS LIST (list operation)
    // =========================================================================
    builder
      .addCase(fetchUsers.pending, createPendingHandler('list'))
      .addCase(fetchUsers.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.users = action.payload.users || [];
        normalized.data.pagination = action.payload.pagination || null;
        normalized.data.initialized.list = true;
        normalized.operations.list = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchUsers.rejected, createRejectedHandler('list'));

    // =========================================================================
    // FETCH USER BY ID (fetch operation)
    // =========================================================================
    builder
      .addCase(fetchUserById.pending, (state, _action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedUser = null; // Clear previous fetched user
        normalized.data.initialized.fetch = false;
        normalized.operations.fetch = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedUser = action.payload;
        normalized.data.initialized.fetch = true;
        normalized.operations.fetch = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.fetchedUser = null;
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
    // CREATE USER (create operation)
    // =========================================================================
    builder
      .addCase(createUser.pending, createPendingHandler('create'))
      .addCase(createUser.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.users.unshift(action.payload);
        normalized.operations.create = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(createUser.rejected, createRejectedHandler('create'));

    // =========================================================================
    // UPDATE USER (update operation)
    // =========================================================================
    builder
      .addCase(updateUser.pending, createPendingHandler('update'))
      .addCase(updateUser.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const index = normalized.data.users.findIndex(
          u => u.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.users[index] = {
            ...normalized.data.users[index],
            ...action.payload,
          };
        }
        normalized.operations.update = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updateUser.rejected, createRejectedHandler('update'));

    // =========================================================================
    // BULK UPDATE STATUS (bulkStatus operation)
    // =========================================================================
    builder
      .addCase(bulkUpdateUserStatus.pending, createPendingHandler('bulkStatus'))
      .addCase(bulkUpdateUserStatus.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        action.payload.forEach(updatedUser => {
          const index = normalized.data.users.findIndex(
            u => u.id === updatedUser.id,
          );
          if (index !== -1) {
            normalized.data.users[index] = {
              ...normalized.data.users[index],
              ...updatedUser,
            };
          }
        });
        normalized.operations.bulkStatus = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        bulkUpdateUserStatus.rejected,
        createRejectedHandler('bulkStatus'),
      );

    // =========================================================================
    // BULK DELETE USERS (bulkDelete operation)
    // =========================================================================
    builder
      .addCase(bulkDeleteUsers.pending, createPendingHandler('bulkDelete'))
      .addCase(bulkDeleteUsers.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.users = normalized.data.users.filter(
          user => !action.payload.includes(user.id),
        );
        normalized.operations.bulkDelete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(bulkDeleteUsers.rejected, createRejectedHandler('bulkDelete'));

    // =========================================================================
    // FETCH USER PERMISSIONS (permissions operation)
    // =========================================================================
    builder
      .addCase(fetchUserPermissions.pending, (state, action) => {
        const normalized = normalizeState(state);
        normalized.permissions.userId = action.meta.arg;
        normalized.operations.permissions = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchUserPermissions.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.permissions.items = action.payload;
        normalized.operations.permissions = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        fetchUserPermissions.rejected,
        createRejectedHandler('permissions'),
      );

    // =========================================================================
    // ASSIGN ROLES TO USER (assignRoles operation)
    // =========================================================================
    builder
      .addCase(assignRolesToUser.pending, createPendingHandler('assignRoles'))
      .addCase(
        assignRolesToUser.fulfilled,
        createFulfilledHandler('assignRoles'),
      )
      .addCase(
        assignRolesToUser.rejected,
        createRejectedHandler('assignRoles'),
      );

    // =========================================================================
    // ASSIGN GROUPS TO USER (assignGroups operation)
    // =========================================================================
    builder
      .addCase(assignGroupsToUser.pending, createPendingHandler('assignGroups'))
      .addCase(
        assignGroupsToUser.fulfilled,
        createFulfilledHandler('assignGroups'),
      )
      .addCase(
        assignGroupsToUser.rejected,
        createRejectedHandler('assignGroups'),
      );
  },
});

export const {
  clearUsersListError,
  clearUserFetchError,
  clearUserCreateError,
  clearUserUpdateError,
  clearUserBulkStatusError,
  clearUserBulkDeleteError,
  clearUserPermissionsError,
  clearUserPermissions,
  resetUsersState,
} = usersSlice.actions;

export default usersSlice.reducer;
