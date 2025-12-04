/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export * from './actions';

export * from './constants';

export function getPermissions(state) {
  return state.permissions.permissions;
}

export function getPermissionsPagination(state) {
  return state.permissions.pagination;
}

export function getPermissionsLoading(state) {
  return state.permissions.loading;
}

export function getPermissionsError(state) {
  return state.permissions.error;
}

export function getPermissionById(state, id) {
  return state.permissions.permissions.find(permission => permission.id === id);
}

export { default } from './reducer';
