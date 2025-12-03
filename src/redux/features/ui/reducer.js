/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  TOGGLE_SIDEBAR,
  OPEN_SIDEBAR,
  CLOSE_SIDEBAR,
  SET_ADMIN_PANEL,
  SET_PAGE_HEADER,
} from './constants';

const initialState = {
  sidebarOpen: false,
  isAdminPanel: false,
  showPageHeader: false,
};

export default function ui(state = initialState, action) {
  switch (action.type) {
    case TOGGLE_SIDEBAR:
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen,
      };
    case OPEN_SIDEBAR:
      return {
        ...state,
        sidebarOpen: true,
      };
    case CLOSE_SIDEBAR:
      return {
        ...state,
        sidebarOpen: false,
      };
    case SET_ADMIN_PANEL:
      return {
        ...state,
        isAdminPanel: action.payload,
      };
    case SET_PAGE_HEADER:
      return {
        ...state,
        showPageHeader: action.payload,
      };
    default:
      return state;
  }
}

// Selectors
export const isSidebarOpen = state => state.ui.sidebarOpen;
export const isAdminPanel = state => state.ui.isAdminPanel;
export const shouldShowPageHeader = state => state.ui.showPageHeader;
