/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_USERS_START,
  FETCH_USERS_SUCCESS,
  FETCH_USERS_ERROR,
  DELETE_USER_START,
  DELETE_USER_SUCCESS,
  DELETE_USER_ERROR,
  UPDATE_USER_STATUS_START,
  UPDATE_USER_STATUS_SUCCESS,
  UPDATE_USER_STATUS_ERROR,
  CREATE_USER_START,
  CREATE_USER_SUCCESS,
  CREATE_USER_ERROR,
  UPDATE_USER_START,
  UPDATE_USER_SUCCESS,
  UPDATE_USER_ERROR,
} from './constants';

const initialState = {
  users: [],
  pagination: null,
  loading: false,
  error: null,
  roles: [],
  rolesLoading: false,
};

export default function usersManagementReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_USERS_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case FETCH_USERS_SUCCESS:
      return {
        ...state,
        loading: false,
        users: action.payload.users || [],
        pagination: action.payload.pagination || null,
        error: null,
      };

    case DELETE_USER_START:
    case UPDATE_USER_STATUS_START:
    case CREATE_USER_START:
    case UPDATE_USER_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case DELETE_USER_SUCCESS:
      return {
        ...state,
        loading: false,
        users: state.users.filter(user => user.id !== action.payload),
        error: null,
      };

    case UPDATE_USER_STATUS_SUCCESS:
    case UPDATE_USER_SUCCESS:
      return {
        ...state,
        loading: false,
        users: state.users.map(user =>
          user.id === action.payload.id ? { ...user, ...action.payload } : user,
        ),
        error: null,
      };

    case CREATE_USER_SUCCESS:
      return {
        ...state,
        loading: false,
        users: [action.payload, ...state.users],
        error: null,
      };

    case FETCH_USERS_ERROR:
    case DELETE_USER_ERROR:
    case UPDATE_USER_STATUS_ERROR:
    case CREATE_USER_ERROR:
    case UPDATE_USER_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    default:
      return state;
  }
}
