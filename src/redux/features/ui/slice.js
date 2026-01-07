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
 * Manages UI-related state such as drawer visibility and flash messages.
 *
 * State shape:
 * {
 *   isAdminDrawerOpen: boolean,
 *   breadcrumbs: Array<{ label: string, url?: string }> | null,
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
  breadcrumbs: null,
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

  // Clone and merge with defaults to ensure all properties exist
  return { ...createFreshState(), ...state };
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
      })
      // Handle navigation success to update breadcrumbs
      .addCase('NAVIGATION_SUCCESS', (state, action) => {
        const { page } = action.payload || {};
        // Store breadcrumbs array from page result
        if (page && page.breadcrumb) {
          state.breadcrumbs = Array.isArray(page.breadcrumb)
            ? page.breadcrumb
            : [page.breadcrumb];
        } else {
          state.breadcrumbs = null;
        }
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
  resetUiState,
} = uiSlice.actions;

export default uiSlice.reducer;
