/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_PERMISSIONS_START,
  FETCH_PERMISSIONS_SUCCESS,
  FETCH_PERMISSIONS_ERROR,
  DELETE_PERMISSION_START,
  DELETE_PERMISSION_SUCCESS,
  DELETE_PERMISSION_ERROR,
  CREATE_PERMISSION_START,
  CREATE_PERMISSION_SUCCESS,
  CREATE_PERMISSION_ERROR,
  UPDATE_PERMISSION_START,
  UPDATE_PERMISSION_SUCCESS,
  UPDATE_PERMISSION_ERROR,
} from './constants';

const initialState = {
  permissions: [],
  pagination: null,
  loading: false,
  error: null,
};

export default function permissionsReducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_PERMISSIONS_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case FETCH_PERMISSIONS_SUCCESS:
      return {
        ...state,
        loading: false,
        permissions: action.payload.permissions || [],
        pagination: action.payload.pagination || null,
        error: null,
      };

    case FETCH_PERMISSIONS_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case DELETE_PERMISSION_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case DELETE_PERMISSION_SUCCESS:
      return {
        ...state,
        loading: false,
        permissions: state.permissions.filter(
          permission => permission.id !== action.payload,
        ),
        error: null,
      };

    case DELETE_PERMISSION_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case CREATE_PERMISSION_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case CREATE_PERMISSION_SUCCESS:
      return {
        ...state,
        loading: false,
        permissions: [...state.permissions, action.payload],
        error: null,
      };

    case CREATE_PERMISSION_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case UPDATE_PERMISSION_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case UPDATE_PERMISSION_SUCCESS:
      return {
        ...state,
        loading: false,
        permissions: state.permissions.map(permission =>
          permission.id === action.payload.id ? action.payload : permission,
        ),
        error: null,
      };

    case UPDATE_PERMISSION_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    default:
      return state;
  }
}
