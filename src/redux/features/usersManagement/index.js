/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export * from './actions';

export * from './constants';

export function getUsers(state) {
  return state.usersManagement.users;
}

export function getUsersPagination(state) {
  return state.usersManagement.pagination;
}

export function getUsersLoading(state) {
  return state.usersManagement.loading;
}

export function getUsersError(state) {
  return state.usersManagement.error;
}

export function getUserById(state, id) {
  return state.usersManagement.users.find(user => user.id === id);
}

export { default } from './reducer';
