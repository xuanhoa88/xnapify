/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: false,
  isAdminPanel: false,
  showPageHeader: false,
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
    toggleSidebar: state => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openSidebar: state => {
      state.sidebarOpen = true;
    },
    closeSidebar: state => {
      state.sidebarOpen = false;
    },
    setAdminPanel: (state, action) => {
      state.isAdminPanel = action.payload;
    },
    setPageHeader: (state, action) => {
      state.showPageHeader = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  openSidebar,
  closeSidebar,
  setAdminPanel,
  setPageHeader,
} = uiSlice.actions;

export default uiSlice.reducer;
