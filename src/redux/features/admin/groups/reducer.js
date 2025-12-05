/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  FETCH_GROUPS_START,
  FETCH_GROUPS_SUCCESS,
  FETCH_GROUPS_ERROR,
  FETCH_GROUP_START,
  FETCH_GROUP_SUCCESS,
  FETCH_GROUP_ERROR,
  CREATE_GROUP_SUCCESS,
  UPDATE_GROUP_SUCCESS,
  DELETE_GROUP_SUCCESS,
  CLEAR_GROUPS_ERROR,
} from './constants';

/**
 * Initial state for groups feature
 */
const initialState = {
  items: [], // Array of group objects
  currentGroup: null, // Currently selected group
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  loading: false,
  error: null,
};

/**
 * Groups reducer
 *
 * Manages groups state including list, pagination, and loading states
 *
 * @param {Object} state - Current groups state
 * @param {Object} action - Redux action
 * @returns {Object} New groups state
 */
export default function groups(state = initialState, action) {
  switch (action.type) {
    case FETCH_GROUPS_START:
    case FETCH_GROUP_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case FETCH_GROUPS_SUCCESS:
      return {
        ...state,
        items: action.payload.groups,
        pagination: action.payload.pagination,
        loading: false,
        error: null,
      };

    case FETCH_GROUP_SUCCESS:
      return {
        ...state,
        currentGroup: action.payload,
        loading: false,
        error: null,
      };

    case FETCH_GROUPS_ERROR:
    case FETCH_GROUP_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case CREATE_GROUP_SUCCESS:
      return {
        ...state,
        items: [action.payload, ...state.items],
        loading: false,
        error: null,
      };

    case UPDATE_GROUP_SUCCESS:
      return {
        ...state,
        items: state.items.map(group =>
          group.id === action.payload.id ? action.payload : group,
        ),
        currentGroup:
          state.currentGroup && state.currentGroup.id === action.payload.id
            ? action.payload
            : state.currentGroup,
        loading: false,
        error: null,
      };

    case DELETE_GROUP_SUCCESS:
      return {
        ...state,
        items: state.items.filter(group => group.id !== action.payload),
        currentGroup:
          state.currentGroup && state.currentGroup.id === action.payload
            ? null
            : state.currentGroup,
        loading: false,
        error: null,
      };

    case CLEAR_GROUPS_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}
