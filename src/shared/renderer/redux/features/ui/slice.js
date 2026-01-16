/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import { initialState } from './utils';

/**
 * UI Slice
 *
 * Manages UI-related state such as drawer visibility, flash messages, and breadcrumbs.
 *
 * State shape:
 * {
 *   drawers: {
 *     [namespace: string]: boolean
 *   },
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

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Toggle drawer open/closed state for a given namespace
     * @param action.payload - Namespace of the drawer (default: 'default')
     */
    toggleDrawer: (state, action) => {
      const namespace = action.payload || 'default';
      if (!state.drawers) {
        state.drawers = {};
      }
      state.drawers[namespace] = !state.drawers[namespace];
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
        if (!state.drawers) {
          state.drawers = {};
        }
        state.drawers.admin = !state.drawers.admin;
      });
  },
});

export const {
  toggleDrawer,
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
