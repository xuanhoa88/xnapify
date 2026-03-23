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
const normalizeBreadcrumbs = items =>
  (Array.isArray(items) ? items : [items]).filter(Boolean);

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
const handleRegisterMenu = (state, payload) => {
  const ns = payload.ns || 'default';
  ensureNamespace(state, 'menus', ns);

  // Fallback for legacy format (e.g. { ns, path } or { item: { path } })
  if (
    !payload.id &&
    !payload.items &&
    (payload.path || (payload.item && payload.item.path))
  ) {
    const itemConfig = payload.item || payload;
    const legacyNs = itemConfig.ns || 'default';
    let section = state.menus[ns].find(s => s.id === legacyNs);

    if (!section) {
      section = {
        id: legacyNs,
        label: legacyNs,
        order: itemConfig.order != null ? itemConfig.order : 99,
        items: [],
      };
      state.menus[ns].push(section);
    }

    const idx = section.items.findIndex(i => i.path === itemConfig.path);
    if (idx >= 0) section.items[idx] = itemConfig;
    else section.items.push(itemConfig);

    return;
  }

  // New nested section format
  const sectionId = payload.id || ns;
  let section = state.menus[ns].find(s => s.id === sectionId);

  if (!section) {
    section = {
      id: sectionId,
      label: payload.label || sectionId,
      order: payload.order != null ? payload.order : 99,
      icon: payload.icon,
      items: [],
    };
    state.menus[ns].push(section);
  } else {
    // Update section priority if explicitly provided and lower
    if (payload.order != null && payload.order < section.order) {
      section.order = payload.order;
    }
    if (payload.label) {
      section.label = payload.label;
    }
    if (payload.icon) {
      section.icon = payload.icon;
    }
  }

  // Add the items
  const itemsToAdd = Array.isArray(payload.items)
    ? payload.items
    : payload.item
      ? [payload.item]
      : [];

  itemsToAdd.forEach(newItem => {
    if (!newItem || !newItem.path) return;
    const existingIndex = section.items.findIndex(i => i.path === newItem.path);
    if (existingIndex >= 0) {
      section.items[existingIndex] = {
        ...section.items[existingIndex],
        ...newItem,
      };
    } else {
      section.items.push(newItem);
    }
  });

  // Sort items by order to ensure deterministic state regardless of
  // registration order (apps vs extensions may register in different
  // order on server vs client, causing SSR hydration mismatches).
  section.items.sort((a, b) => {
    const orderDiff =
      (a.order != null ? a.order : 99) - (b.order != null ? b.order : 99);
    if (orderDiff !== 0) return orderDiff;
    return (a.label || '').localeCompare(b.label || '');
  });
};

// Shared menu unregistration logic
const handleUnregisterMenu = (state, ns = 'default', path) => {
  if (state.menus && state.menus[ns]) {
    state.menus[ns].forEach(section => {
      section.items = section.items.filter(i => i.path !== path);
    });
    // Remove empty sections
    state.menus[ns] = state.menus[ns].filter(
      section => section.items.length > 0,
    );
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
     * Register one or multiple menu sections
     * Payload: rest parameter array of menu objects
     */
    registerMenu: {
      reducer: (state, action) => {
        action.payload.forEach(menu => {
          handleRegisterMenu(state, menu);
        });
      },
      prepare: (...menus) => ({
        payload: menus,
      }),
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
        // Legacy fallback
        const payload = action.payload.item
          ? { ns: action.payload.ns, ...action.payload.item }
          : action.payload;
        handleRegisterMenu(state, payload);
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
