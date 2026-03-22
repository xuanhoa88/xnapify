/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import {
  fetchExtensions,
  uploadExtension,
  upgradeExtension,
  toggleExtensionStatus,
  uninstallExtension,
} from './thunks';

/**
 * Extensions Slice
 */

const createOperationState = () => ({ loading: false, error: null });

/**
 * Create a fresh operations object with all operation states.
 */
const createFreshOperations = () => ({
  list: createOperationState(),
  upload: createOperationState(),
  upgrade: createOperationState(),
  toggleStatus: createOperationState(),
  uninstall: createOperationState(),
});

/**
 * Create fresh data object
 */
const createFreshData = () => ({
  extensions: [],
  initialized: false,
});

// Initial state with fresh operations
const initialState = {
  data: createFreshData(),
  operations: createFreshOperations(),
};

/**
 * Normalize state to ensure it has the expected shape.
 * Always clones operations to avoid SSR frozen state issues.
 * Exported for reuse in selectors.
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return {
      data: createFreshData(),
      operations: createFreshOperations(),
    };
  }

  // State already has proper structure
  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  // Return fresh state for unknown formats
  return {
    data: createFreshData(),
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

export const SLICE_NAME = '@admin/extensions';

const extensionsSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearExtensionListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearExtensionUploadError: state => {
      const normalized = normalizeState(state);
      normalized.operations.upload.error = null;
      Object.assign(state, normalized);
    },
    clearExtensionUpgradeError: state => {
      const normalized = normalizeState(state);
      normalized.operations.upgrade.error = null;
      Object.assign(state, normalized);
    },
    clearExtensionToggleError: state => {
      const normalized = normalizeState(state);
      normalized.operations.toggleStatus.error = null;
      Object.assign(state, normalized);
    },
    clearExtensionUninstallError: state => {
      const normalized = normalizeState(state);
      normalized.operations.uninstall.error = null;
      Object.assign(state, normalized);
    },
    resetExtensionsState: () => initialState,
  },
  extraReducers: builder => {
    // List
    builder
      .addCase(fetchExtensions.pending, createPendingHandler('list'))
      .addCase(fetchExtensions.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.list = createOperationState();
        normalized.data.extensions = action.payload;
        normalized.data.initialized = true;
        Object.assign(state, normalized);
      })
      .addCase(fetchExtensions.rejected, createRejectedHandler('list'));

    // Upload
    builder
      .addCase(uploadExtension.pending, createPendingHandler('upload'))
      .addCase(uploadExtension.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.upload = createOperationState();
        // Add new extension to list or replace if exists
        const index = normalized.data.extensions.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.extensions[index] = action.payload;
        } else {
          normalized.data.extensions.push(action.payload);
        }
        Object.assign(state, normalized);
      })
      .addCase(uploadExtension.rejected, createRejectedHandler('upload'));

    // Upgrade
    builder
      .addCase(upgradeExtension.pending, createPendingHandler('upgrade'))
      .addCase(upgradeExtension.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.upgrade = createOperationState();
        const index = normalized.data.extensions.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.extensions[index] = action.payload;
        }
        Object.assign(state, normalized);
      })
      .addCase(upgradeExtension.rejected, createRejectedHandler('upgrade'));

    // Toggle Status
    builder
      .addCase(
        toggleExtensionStatus.pending,
        createPendingHandler('toggleStatus'),
      )
      .addCase(toggleExtensionStatus.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.toggleStatus = createOperationState();
        const index = normalized.data.extensions.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.extensions[index] = action.payload;
        }
        Object.assign(state, normalized);
      })
      .addCase(
        toggleExtensionStatus.rejected,
        createRejectedHandler('toggleStatus'),
      );

    // Uninstall
    builder
      .addCase(uninstallExtension.pending, createPendingHandler('uninstall'))
      .addCase(uninstallExtension.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.uninstall = createOperationState();
        normalized.data.extensions = normalized.data.extensions.filter(
          p => p.id !== action.payload,
        );
        Object.assign(state, normalized);
      })
      .addCase(uninstallExtension.rejected, createRejectedHandler('uninstall'));
  },
});

export const {
  clearExtensionListError,
  clearExtensionUploadError,
  clearExtensionUpgradeError,
  clearExtensionToggleError,
  clearExtensionUninstallError,
  resetExtensionsState,
} = extensionsSlice.actions;

export default extensionsSlice.reducer;
