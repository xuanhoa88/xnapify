/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export * from './actions';

export * from './constants';

export function getRoles(state) {
  return state.roles.roles;
}

export function getCurrentRole(state) {
  return state.roles.currentRole;
}

export function getRolesPagination(state) {
  return state.roles.pagination;
}

export function getRolesLoading(state) {
  return state.roles.loading;
}

export function getRolesError(state) {
  return state.roles.error;
}

export function getRoleById(state, id) {
  return state.roles.roles.find(role => role.id === id);
}

export { default } from './reducer';
