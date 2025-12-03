/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Redux Features - Public API
 *
 * Centralized export point for all Redux features.
 * Each feature is self-contained with its own actions, constants, and reducer.
 *
 * Features follow the Redux Ducks pattern:
 * - features/featureName/index.js - Public API
 * - features/featureName/actions.js - Action creators (private)
 * - features/featureName/constants.js - Action types (private)
 * - features/featureName/reducer.js - State reducer (private)
 */

// =============================================================================
// FEATURE: INTL (Internationalization)
// =============================================================================

export {
  // Actions
  setLocale,
  // Constants
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  SET_LOCALE_START,
  SET_LOCALE_SUCCESS,
  SET_LOCALE_ERROR,
  SET_LOCALE_FALLBACK,
  // Selectors
  getLocale,
  getLocaleLoading,
  isLocaleLoading,
  getLocaleMessages,
  getLocaleFallback,
  // Reducer (default export from feature)
  default as intlReducer,
} from './intl';

// =============================================================================
// FEATURE: RUNTIME (Runtime Variables)
// =============================================================================

export {
  // Actions
  setRuntimeVariable,
  // Constants
  SET_RUNTIME_VARIABLE,
  // Selectors
  getRuntimeVariable,
  // Reducer (default export from feature)
  default as runtimeReducer,
} from './runtime';

// =============================================================================
// FEATURE: USER (Authentication)
// =============================================================================

export {
  // Actions
  login,
  register,
  logout,
  getCurrentUser,
  resetPassword,
  updateUser,
  // Constants
  LOGIN_START,
  LOGIN_SUCCESS,
  LOGIN_ERROR,
  REGISTER_START,
  REGISTER_SUCCESS,
  REGISTER_ERROR,
  LOGOUT,
  FETCH_USER_START,
  FETCH_USER_SUCCESS,
  FETCH_USER_ERROR,
  RESET_PASSWORD_START,
  RESET_PASSWORD_SUCCESS,
  RESET_PASSWORD_ERROR,
  UPDATE_USER,
  // Selectors
  getUser,
  isAuthenticated,
  isAdmin,
  getUserId,
  getUserEmail,
  getUserDisplayName,
  // Reducer (default export from feature)
  default as userReducer,
} from './user';

// =============================================================================
// FEATURE: UI (UI State)
// =============================================================================
export {
  // Actions
  toggleSidebar,
  openSidebar,
  closeSidebar,
  setAdminPanel,
  // Constants
  TOGGLE_SIDEBAR,
  OPEN_SIDEBAR,
  CLOSE_SIDEBAR,
  SET_ADMIN_PANEL,
  // Selectors
  isSidebarOpen,
  isAdminPanel,
  setPageHeader,
  shouldShowPageHeader,
  // Reducer (default export from feature)
  default as uiReducer,
} from './ui';

// =============================================================================
// FEATURE: GROUPS (Group Management)
// =============================================================================
export {
  // Actions
  fetchGroups,
  fetchGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  clearGroupsError,
  // Constants
  FETCH_GROUPS_START,
  FETCH_GROUPS_SUCCESS,
  FETCH_GROUPS_ERROR,
  FETCH_GROUP_START,
  FETCH_GROUP_SUCCESS,
  FETCH_GROUP_ERROR,
  CREATE_GROUP_START,
  CREATE_GROUP_SUCCESS,
  CREATE_GROUP_ERROR,
  UPDATE_GROUP_START,
  UPDATE_GROUP_SUCCESS,
  UPDATE_GROUP_ERROR,
  DELETE_GROUP_START,
  DELETE_GROUP_SUCCESS,
  DELETE_GROUP_ERROR,
  CLEAR_GROUPS_ERROR,
  // Selectors
  getGroups,
  getCurrentGroup,
  getGroupsPagination,
  getGroupsLoading,
  getGroupsError,
  getGroupById,
  // Reducer (default export from feature)
  default as groupsReducer,
} from './groups';
