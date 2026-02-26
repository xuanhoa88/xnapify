/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import {
  fetchPlugins,
  uploadPlugin,
  upgradePlugin,
  togglePluginStatus,
  uninstallPlugin,
} from './thunks';

/**
 * Plugins Slice
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
  plugins: [],
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

export const SLICE_NAME = '@admin/plugins';

const pluginsSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearPluginListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearPluginUploadError: state => {
      const normalized = normalizeState(state);
      normalized.operations.upload.error = null;
      Object.assign(state, normalized);
    },
    clearPluginUpgradeError: state => {
      const normalized = normalizeState(state);
      normalized.operations.upgrade.error = null;
      Object.assign(state, normalized);
    },
    clearPluginToggleError: state => {
      const normalized = normalizeState(state);
      normalized.operations.toggleStatus.error = null;
      Object.assign(state, normalized);
    },
    clearPluginUninstallError: state => {
      const normalized = normalizeState(state);
      normalized.operations.uninstall.error = null;
      Object.assign(state, normalized);
    },
    resetPluginsState: () => initialState,
  },
  extraReducers: builder => {
    // List
    builder
      .addCase(fetchPlugins.pending, createPendingHandler('list'))
      .addCase(fetchPlugins.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.list = createOperationState();
        normalized.data.plugins = action.payload;
        normalized.data.initialized = true;
        Object.assign(state, normalized);
      })
      .addCase(fetchPlugins.rejected, createRejectedHandler('list'));

    // Upload
    builder
      .addCase(uploadPlugin.pending, createPendingHandler('upload'))
      .addCase(uploadPlugin.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.upload = createOperationState();
        // Add new plugin to list or replace if exists
        const index = normalized.data.plugins.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.plugins[index] = action.payload;
        } else {
          normalized.data.plugins.push(action.payload);
        }
        Object.assign(state, normalized);
      })
      .addCase(uploadPlugin.rejected, createRejectedHandler('upload'));

    // Upgrade
    builder
      .addCase(upgradePlugin.pending, createPendingHandler('upgrade'))
      .addCase(upgradePlugin.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.upgrade = createOperationState();
        const index = normalized.data.plugins.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.plugins[index] = action.payload;
        }
        Object.assign(state, normalized);
      })
      .addCase(upgradePlugin.rejected, createRejectedHandler('upgrade'));

    // Toggle Status
    builder
      .addCase(togglePluginStatus.pending, createPendingHandler('toggleStatus'))
      .addCase(togglePluginStatus.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.toggleStatus = createOperationState();
        const index = normalized.data.plugins.findIndex(
          p => p.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.plugins[index] = action.payload;
        }
        Object.assign(state, normalized);
      })
      .addCase(
        togglePluginStatus.rejected,
        createRejectedHandler('toggleStatus'),
      );

    // Uninstall
    builder
      .addCase(uninstallPlugin.pending, createPendingHandler('uninstall'))
      .addCase(uninstallPlugin.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.uninstall = createOperationState();
        normalized.data.plugins = normalized.data.plugins.filter(
          p => p.id !== action.payload,
        );
        Object.assign(state, normalized);
      })
      .addCase(uninstallPlugin.rejected, createRejectedHandler('uninstall'));
  },
});

export const {
  clearPluginListError,
  clearPluginUploadError,
  clearPluginUpgradeError,
  clearPluginToggleError,
  clearPluginUninstallError,
  resetPluginsState,
} = pluginsSlice.actions;

export default pluginsSlice.reducer;
