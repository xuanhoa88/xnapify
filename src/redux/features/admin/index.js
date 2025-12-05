/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { combineReducers } from 'redux';
import roles from './roles';
import groups from './groups';
import permissions from './permissions';
import users from './users';
import dashboard from './dashboard';

/**
 * Admin Feature Reducer
 *
 * Combines all admin-related reducers into a single admin state slice.
 * This creates a state structure like: state.admin.roles, state.admin.groups, state.admin.permissions, state.admin.users, state.admin.dashboard, etc.
 */
export default combineReducers({
  roles,
  groups,
  permissions,
  users,
  dashboard,
});

// Re-export all roles actions, constants, and selectors
export * from './roles';

// Re-export all groups actions, constants, and selectors
export * from './groups';

// Re-export all permissions actions, constants, and selectors
export * from './permissions';

// Re-export all users actions, constants, and selectors
export * from './users';

// Re-export all dashboard actions, constants, and selectors
export * from './dashboard';
