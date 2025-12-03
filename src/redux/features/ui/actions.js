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

export function toggleSidebar() {
  return {
    type: TOGGLE_SIDEBAR,
  };
}

export function openSidebar() {
  return {
    type: OPEN_SIDEBAR,
  };
}

export function closeSidebar() {
  return {
    type: CLOSE_SIDEBAR,
  };
}

export function setAdminPanel(isAdmin) {
  return {
    type: SET_ADMIN_PANEL,
    payload: isAdmin,
  };
}

export function setPageHeader(show) {
  return {
    type: SET_PAGE_HEADER,
    payload: show,
  };
}
