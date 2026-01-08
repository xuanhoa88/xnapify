/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * UI Slice
 *
 * Manages UI-related state such as drawer visibility, flash messages, and breadcrumbs.
 *
 * State shape:
 * {
 *   isAdminDrawerOpen: boolean,
 *   breadcrumbs: {
 *     [namespace: string]: Array<{ label: string, url?: string }>
 *   },
 *   flashMessage: null | {
 *     variant: 'success' | 'error' | 'warning' | 'info',
 *     message: string,
 *     placement?: string,
 *     title?: string,
 *     duration?: number
 *   }
 * }
 */

/**
 * Create a fresh state object with default values.
 * This ensures we never return a reference to a frozen initialState.
 */
const createFreshState = () => ({
  isAdminDrawerOpen: false,
  breadcrumbs: {},
  flashMessage: null,
});

// Initial state with fresh values
const initialState = createFreshState();

/**
 * Normalize state to ensure it has the expected shape.
 * This handles migration from old state format or SSR hydration.
 * Always clones to ensure mutability (avoids SSR frozen state issues).
 * Exported for reuse in selectors.
 *
 * @param {Object|null|undefined} state - UI state to normalize
 * @returns {Object} Normalized state with expected shape
 */
export const normalizeState = state => {
  // Handle null/undefined/non-object
  if (!state || typeof state !== 'object') {
    return createFreshState();
  }

  // Handle legacy breadcrumbs format (array -> object)
  const normalizedBreadcrumbs =
    state.breadcrumbs && typeof state.breadcrumbs === 'object'
      ? Array.isArray(state.breadcrumbs)
        ? { default: state.breadcrumbs }
        : state.breadcrumbs
      : {};

  // Clone and merge with defaults to ensure all properties exist
  return {
    ...createFreshState(),
    ...state,
    breadcrumbs: normalizedBreadcrumbs,
  };
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Toggle admin drawer open/closed state
     */
    toggleAdminDrawer: state => {
      state.isAdminDrawerOpen = !state.isAdminDrawerOpen;
    },

    /**
     * Set flash message with full payload
     */
    setFlashMessage: (state, action) => {
      state.flashMessage = action.payload;
    },

    /**
     * Clear flash message
     */
    clearFlashMessage: state => {
      state.flashMessage = null;
    },

    /**
     * Show success flash message
     */
    showSuccessMessage: (state, action) => {
      state.flashMessage = { ...action.payload, variant: 'success' };
    },

    /**
     * Show error flash message
     */
    showErrorMessage: (state, action) => {
      state.flashMessage = { ...action.payload, variant: 'error' };
    },

    /**
     * Show warning flash message
     */
    showWarningMessage: (state, action) => {
      state.flashMessage = { ...action.payload, variant: 'warning' };
    },

    /**
     * Show info flash message
     */
    showInfoMessage: (state, action) => {
      state.flashMessage = { ...action.payload, variant: 'info' };
    },

    /**
     * Initialize/set breadcrumbs for namespace(s)
     * Usage:
     *   setBreadcrumbs('admin') - Reset namespace to empty
     *   setBreadcrumbs({ admin: { label, url } }) - Set single item
     *   setBreadcrumbs({ admin: [{ label, url }, ...] }) - Set array of items
     */
    setBreadcrumbs: (state, action) => {
      const { payload } = action;

      // String: reset namespace to empty array
      if (typeof payload === 'string') {
        state.breadcrumbs[payload] = [];
        return;
      }

      // Object: set breadcrumbs for each namespace
      if (payload && typeof payload === 'object') {
        Object.entries(payload).forEach(([namespace, items]) => {
          // Normalize to array
          state.breadcrumbs[namespace || 'default'] = Array.isArray(items)
            ? items
            : [items];
        });
      }
    },

    /**
     * Add breadcrumb(s) to a namespace
     * Usage: addBreadcrumb(item, namespace) or addBreadcrumb([items], namespace)
     */
    addBreadcrumb: {
      reducer: (state, action) => {
        const { item, namespace = 'default' } = action.payload;

        // Initialize namespace if not exists
        if (!state.breadcrumbs[namespace]) {
          state.breadcrumbs[namespace] = [];
        }

        // Add single item or array of items
        if (Array.isArray(item)) {
          state.breadcrumbs[namespace].push(...item);
        } else {
          state.breadcrumbs[namespace].push(item);
        }
      },
      prepare: (item, namespace) => ({
        payload: { item, namespace },
      }),
    },

    /**
     * Clear breadcrumbs for a namespace
     * @param action.payload - Namespace to clear
     */
    clearBreadcrumbs: (state, action) => {
      const namespace = action.payload;
      if (state.breadcrumbs[namespace]) {
        state.breadcrumbs[namespace] = [];
      }
    },

    /**
     * Reset to initial state
     */
    resetUiState: () => initialState,
  },
  extraReducers: builder => {
    // Keep legacy action types for backward compatibility
    builder
      .addCase('FLASH_MESSAGE', (state, action) => {
        state.flashMessage = action.payload;
      })
      .addCase('FLASH_MESSAGE_CLEAR', state => {
        state.flashMessage = null;
      })
      .addCase('FLASH_MESSAGE_SUCCESS', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'success' };
      })
      .addCase('FLASH_MESSAGE_ERROR', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'error' };
      })
      .addCase('FLASH_MESSAGE_WARNING', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'warning' };
      })
      .addCase('FLASH_MESSAGE_INFO', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'info' };
      })
      .addCase('TOGGLE_ADMIN_DRAWER', state => {
        state.isAdminDrawerOpen = !state.isAdminDrawerOpen;
      });
  },
});

export const {
  toggleAdminDrawer,
  setFlashMessage,
  clearFlashMessage,
  showSuccessMessage,
  showErrorMessage,
  showWarningMessage,
  showInfoMessage,
  setBreadcrumbs,
  addBreadcrumb,
  clearBreadcrumbs,
  resetUiState,
} = uiSlice.actions;

export default uiSlice.reducer;
