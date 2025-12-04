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
  me,
  resetPassword,
  updateCurrentUser,
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
  getCurrentUser,
  isAuthenticated,
  isAdmin,
  getCurrentUserId,
  getCurrentUserEmail,
  getCurrentUserDisplayName,
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

// =============================================================================
// FEATURE: ROLES (Role Management)
// =============================================================================
export {
  // Actions
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  // Constants
  FETCH_ROLES_START,
  FETCH_ROLES_SUCCESS,
  FETCH_ROLES_ERROR,
  CREATE_ROLE_START,
  CREATE_ROLE_SUCCESS,
  CREATE_ROLE_ERROR,
  UPDATE_ROLE_START,
  UPDATE_ROLE_SUCCESS,
  UPDATE_ROLE_ERROR,
  DELETE_ROLE_START,
  DELETE_ROLE_SUCCESS,
  DELETE_ROLE_ERROR,
  // Selectors
  getRoles,
  getCurrentRole,
  getRolesPagination,
  getRolesLoading,
  getRolesError,
  getRoleById,
  // Reducer (default export from feature)
  default as rolesReducer,
} from './roles';

// =============================================================================
// FEATURE: PERMISSIONS (Permission Management)
// =============================================================================
export {
  // Actions
  fetchPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  // Constants
  FETCH_PERMISSIONS_START,
  FETCH_PERMISSIONS_SUCCESS,
  FETCH_PERMISSIONS_ERROR,
  CREATE_PERMISSION_START,
  CREATE_PERMISSION_SUCCESS,
  CREATE_PERMISSION_ERROR,
  UPDATE_PERMISSION_START,
  UPDATE_PERMISSION_SUCCESS,
  UPDATE_PERMISSION_ERROR,
  DELETE_PERMISSION_START,
  DELETE_PERMISSION_SUCCESS,
  DELETE_PERMISSION_ERROR,
  // Selectors
  getPermissions,
  getPermissionsPagination,
  getPermissionsLoading,
  getPermissionsError,
  getPermissionById,
  // Reducer (default export from feature)
  default as permissionsReducer,
} from './permissions';

// =============================================================================
// FEATURE: USERS MANAGEMENT (Admin User Management)
// =============================================================================
export {
  // Actions
  fetchUsers,
  deleteUser,
  updateUserStatus,
  createUser,
  updateUser,
  // Constants
  FETCH_USERS_START,
  FETCH_USERS_SUCCESS,
  FETCH_USERS_ERROR,
  DELETE_USER_START,
  DELETE_USER_SUCCESS,
  DELETE_USER_ERROR,
  UPDATE_USER_STATUS_START,
  UPDATE_USER_STATUS_SUCCESS,
  UPDATE_USER_STATUS_ERROR,
  // Selectors
  getUsers,
  getUsersPagination,
  getUsersLoading,
  getUsersError,
  getUserById,
  // Reducer (default export from feature)
  default as usersManagementReducer,
} from './usersManagement';
