/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  adminSidebarOpen: false,
  isAdminPanel: false,
};

/**
 * UI Slice
 *
 * Manages UI-related state such as sidebar visibility and panel modes.
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleAdminSidebar: state => {
      state.adminSidebarOpen = !state.adminSidebarOpen;
    },
    openAdminSidebar: state => {
      state.adminSidebarOpen = true;
    },
    closeAdminSidebar: state => {
      state.adminSidebarOpen = false;
    },
    setAdminPanel: (state, action) => {
      state.isAdminPanel = action.payload;
    },
  },
});

export const {
  toggleAdminSidebar,
  openAdminSidebar,
  closeAdminSidebar,
  setAdminPanel,
} = uiSlice.actions;

export default uiSlice.reducer;
