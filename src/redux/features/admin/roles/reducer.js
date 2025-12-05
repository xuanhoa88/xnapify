/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_ROLES_START,
  FETCH_ROLES_SUCCESS,
  FETCH_ROLES_ERROR,
  DELETE_ROLE_START,
  DELETE_ROLE_SUCCESS,
  DELETE_ROLE_ERROR,
  CREATE_ROLE_START,
  CREATE_ROLE_SUCCESS,
  CREATE_ROLE_ERROR,
  UPDATE_ROLE_START,
  UPDATE_ROLE_SUCCESS,
  UPDATE_ROLE_ERROR,
} from './constants';

const initialState = {
  roles: [],
  pagination: null,
  loading: false,
  error: null,
};

export default function rolesReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_ROLES_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case FETCH_ROLES_SUCCESS:
      return {
        ...state,
        loading: false,
        roles: action.payload.roles || [],
        pagination: action.payload.pagination || null,
        error: null,
      };

    case FETCH_ROLES_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case DELETE_ROLE_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case DELETE_ROLE_SUCCESS:
      return {
        ...state,
        loading: false,
        roles: state.roles.filter(role => role.id !== action.payload),
        error: null,
      };

    case DELETE_ROLE_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case CREATE_ROLE_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case CREATE_ROLE_SUCCESS:
      return {
        ...state,
        loading: false,
        roles: [...state.roles, action.payload],
        error: null,
      };

    case CREATE_ROLE_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case UPDATE_ROLE_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case UPDATE_ROLE_SUCCESS:
      return {
        ...state,
        loading: false,
        roles: state.roles.map(role =>
          role.id === action.payload.id ? action.payload : role,
        ),
        error: null,
      };

    case UPDATE_ROLE_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    default:
      return state;
  }
}
