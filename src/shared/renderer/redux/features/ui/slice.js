/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';
import { initialState } from './utils';

/**
 * Shared Logic Utilities
 */

// Flash message variant types
const FLASH_VARIANTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

// Helper to create flash message payload
const createFlashMessage = (payload, variant) => ({
  ...payload,
  variant,
});

// Helper to ensure namespace exists in state
const ensureNamespace = (state, collection, namespace = 'default') => {
  if (!state[collection]) {
    state[collection] = {};
  }
  if (!state[collection][namespace]) {
    state[collection][namespace] = collection === 'drawers' ? false : [];
  }
};

// Helper to normalize breadcrumb items to array
const normalizeBreadcrumbs = items => (Array.isArray(items) ? items : [items]);

// Helper to find menu item by path
const findMenuItemIndex = (items, path) =>
  items.findIndex(i => i.path === path);

/**
 * Reducer Helpers
 */

// Shared drawer toggle logic
const handleDrawerToggle = (state, namespace = 'default') => {
  ensureNamespace(state, 'drawers', namespace);
  state.drawers[namespace] = !state.drawers[namespace];
};

// Shared flash message logic
const handleFlashMessage = (state, payload, variant = null) => {
  state.flashMessage = variant ? createFlashMessage(payload, variant) : payload;
};

// Shared breadcrumb setting logic
const handleSetBreadcrumbs = (state, payload) => {
  // String: reset namespace to empty array
  if (typeof payload === 'string') {
    state.breadcrumbs[payload] = [];
    return;
  }

  // Object: set breadcrumbs for each namespace
  if (payload && typeof payload === 'object') {
    Object.entries(payload).forEach(([namespace, items]) => {
      state.breadcrumbs[namespace || 'default'] = normalizeBreadcrumbs(items);
    });
  }
};

// Shared breadcrumb add logic
const handleAddBreadcrumb = (state, item, namespace = 'default') => {
  ensureNamespace(state, 'breadcrumbs', namespace);
  const newItems = normalizeBreadcrumbs(item);
  state.breadcrumbs[namespace].push(...newItems);
};

// Shared menu registration logic
const handleRegisterMenu = (state, ns = 'default', item) => {
  ensureNamespace(state, 'menus', ns);

  const existingIndex = findMenuItemIndex(state.menus[ns], item.path);
  if (existingIndex >= 0) {
    // Update existing
    state.menus[ns][existingIndex] = item;
  } else {
    // Add new
    state.menus[ns].push(item);
  }
};

// Shared menu unregistration logic
const handleUnregisterMenu = (state, ns = 'default', path) => {
  if (state.menus && state.menus[ns]) {
    state.menus[ns] = state.menus[ns].filter(i => i.path !== path);
  }
};

/**
 * UI Slice
 *
 * Manages UI-related state such as drawer visibility, flash messages, and breadcrumbs.
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
      handleDrawerToggle(state, action.payload);
    },

    /**
     * Set flash message with full payload
     */
    setFlashMessage: (state, action) => {
      handleFlashMessage(state, action.payload);
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
      handleFlashMessage(state, action.payload, FLASH_VARIANTS.SUCCESS);
    },

    /**
     * Show error flash message
     */
    showErrorMessage: (state, action) => {
      handleFlashMessage(state, action.payload, FLASH_VARIANTS.ERROR);
    },

    /**
     * Show warning flash message
     */
    showWarningMessage: (state, action) => {
      handleFlashMessage(state, action.payload, FLASH_VARIANTS.WARNING);
    },

    /**
     * Show info flash message
     */
    showInfoMessage: (state, action) => {
      handleFlashMessage(state, action.payload, FLASH_VARIANTS.INFO);
    },

    /**
     * Initialize/set breadcrumbs for namespace(s)
     * Usage:
     *   setBreadcrumbs('admin') - Reset namespace to empty
     *   setBreadcrumbs({ admin: { label, url } }) - Set single item
     *   setBreadcrumbs({ admin: [{ label, url }, ...] }) - Set array of items
     */
    setBreadcrumbs: (state, action) => {
      handleSetBreadcrumbs(state, action.payload);
    },

    /**
     * Add breadcrumb(s) to a namespace
     * Usage: addBreadcrumb(item, namespace) or addBreadcrumb([items], namespace)
     */
    addBreadcrumb: {
      reducer: (state, action) => {
        const { item, namespace } = action.payload;
        handleAddBreadcrumb(state, item, namespace);
      },
      prepare: (item, namespace = 'default') => ({
        payload: { item, namespace },
      }),
    },

    /**
     * Clear breadcrumbs for a namespace
     * @param action.payload - Namespace to clear
     */
    clearBreadcrumbs: (state, action) => {
      if (state.breadcrumbs[action.payload]) {
        state.breadcrumbs[action.payload] = [];
      }
    },

    /**
     * Register a menu item
     * Payload: { ns, item }
     */
    registerMenu: (state, action) => {
      const { ns, item } = action.payload;
      handleRegisterMenu(state, ns, item);
    },

    /**
     * Unregister a menu item
     * Payload: { ns, path }
     */
    unregisterMenu: (state, action) => {
      const { ns, path } = action.payload;
      handleUnregisterMenu(state, ns, path);
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
        handleFlashMessage(state, action.payload);
      })
      .addCase('FLASH_MESSAGE_CLEAR', state => {
        state.flashMessage = null;
      })
      .addCase('FLASH_MESSAGE_SUCCESS', (state, action) => {
        handleFlashMessage(state, action.payload, FLASH_VARIANTS.SUCCESS);
      })
      .addCase('FLASH_MESSAGE_ERROR', (state, action) => {
        handleFlashMessage(state, action.payload, FLASH_VARIANTS.ERROR);
      })
      .addCase('FLASH_MESSAGE_WARNING', (state, action) => {
        handleFlashMessage(state, action.payload, FLASH_VARIANTS.WARNING);
      })
      .addCase('FLASH_MESSAGE_INFO', (state, action) => {
        handleFlashMessage(state, action.payload, FLASH_VARIANTS.INFO);
      })
      .addCase('TOGGLE_DRAWER', (state, action) => {
        handleDrawerToggle(state, action.payload);
      })
      .addCase('SET_BREADCRUMBS', (state, action) => {
        const { ns = 'default', items } = action.payload;
        state.breadcrumbs[ns] = normalizeBreadcrumbs(items);
      })
      .addCase('ADD_BREADCRUMB', (state, action) => {
        const { ns, item } = action.payload;
        handleAddBreadcrumb(state, item, ns);
      })
      .addCase('CLEAR_BREADCRUMBS', (state, action) => {
        if (state.breadcrumbs[action.payload]) {
          state.breadcrumbs[action.payload] = [];
        }
      })
      .addCase('REGISTER_MENU', (state, action) => {
        const { ns, item } = action.payload;
        handleRegisterMenu(state, ns, item);
      })
      .addCase('UNREGISTER_MENU', (state, action) => {
        const { ns, path } = action.payload;
        handleUnregisterMenu(state, ns, path);
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
  registerMenu,
  unregisterMenu,
} = uiSlice.actions;

export { FLASH_VARIANTS };
export default uiSlice.reducer;
