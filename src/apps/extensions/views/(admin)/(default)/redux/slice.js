/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import {
  fetchExtensions,
  uploadExtension,
  toggleExtensionStatus,
  uninstallExtension,
  REQUEST_ABORTED,
} from './thunks.js';

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
 * Locate an extension in the list by its canonical key.
 *
 * List rows are keyed by the manifest id (mirrored in the DB as `key`), while
 * single-record endpoints may echo back either that key or the DB UUID. Match
 * on both so a write response always finds the row it belongs to.
 */
const findExtensionIndex = (extensions, payload) => {
  if (!payload) return -1;
  const candidates = [payload.id, payload.key].filter(Boolean);
  if (candidates.length === 0) return -1;
  return extensions.findIndex(
    p => candidates.includes(p.id) || candidates.includes(p.key),
  );
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
    /**
     * Drop a row's transient `job_status`.
     *
     * The card renders a pending badge instead of the switch whenever the row
     * carries one (ExtensionCard resolvedActionLabel), and the toggle
     * response injects it. Clearing the client-side actionMap alone is not
     * enough — and it also cancels the safety timer — so a completion event
     * has to strip the server-side half too, or the badge outlives the job
     * it describes.
     */
    clearExtensionJobStatus: (state, action) => {
      const normalized = normalizeState(state);
      const index = findExtensionIndex(normalized.data.extensions, {
        id: action.payload,
      });
      if (index !== -1 && normalized.data.extensions[index].job_status) {
        const { job_status: _dropped, ...rest } =
          normalized.data.extensions[index];
        normalized.data.extensions[index] = rest;
        Object.assign(state, normalized);
      }
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
      .addCase(fetchExtensions.rejected, (state, action) => {
        // An aborted request is not a failure — the component unmounted or a
        // newer fetch superseded it. Keep the list and surface no error.
        if (action.payload === REQUEST_ABORTED) {
          const normalized = normalizeState(state);
          normalized.operations.list.loading = false;
          Object.assign(state, normalized);
          return;
        }
        createRejectedHandler('list')(state, action);
      });

    // Upload
    builder
      .addCase(uploadExtension.pending, createPendingHandler('upload'))
      .addCase(uploadExtension.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.upload = createOperationState();
        // Add new extension to list or replace if exists
        const index = findExtensionIndex(
          normalized.data.extensions,
          action.payload,
        );
        if (index !== -1) {
          // Merge, don't replace: the list row carries filesystem-derived
          // fields (source, icon, runtime, compatibility) that the DB record
          // returned here does not have.
          normalized.data.extensions[index] = {
            ...normalized.data.extensions[index],
            ...action.payload,
          };
        } else if (action.payload) {
          normalized.data.extensions.push(action.payload);
        }
        Object.assign(state, normalized);
      })
      .addCase(uploadExtension.rejected, createRejectedHandler('upload'));

    // Toggle Status
    builder
      .addCase(
        toggleExtensionStatus.pending,
        createPendingHandler('toggleStatus'),
      )
      .addCase(toggleExtensionStatus.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.operations.toggleStatus = createOperationState();
        const index = findExtensionIndex(
          normalized.data.extensions,
          action.payload,
        );
        if (index !== -1) {
          // Merge so the row keeps its filesystem-derived fields while picking
          // up the new is_active / job_status from the server.
          normalized.data.extensions[index] = {
            ...normalized.data.extensions[index],
            ...action.payload,
          };
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
        // Don't remove from list — let the WS EXTENSION_UNINSTALLED event
        // trigger a re-fetch which removes it once the backend confirms.
        // The actionMap label ("Uninstalling...") provides visual feedback.
        void action.payload;
        Object.assign(state, normalized);
      })
      .addCase(uninstallExtension.rejected, createRejectedHandler('uninstall'));
  },
});

export const {
  clearExtensionListError,
  clearExtensionUploadError,
  clearExtensionToggleError,
  clearExtensionUninstallError,
  clearExtensionJobStatus,
  resetExtensionsState,
} = extensionsSlice.actions;

export default extensionsSlice.reducer;
