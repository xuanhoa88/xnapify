/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isAdminSidebarOpen: false,
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
      state.isAdminSidebarOpen = !state.isAdminSidebarOpen;
    },
  },
});

export const { toggleAdminSidebar } = uiSlice.actions;

export default uiSlice.reducer;
