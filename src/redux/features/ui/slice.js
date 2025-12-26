/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  /**
   * Admin drawer open state
   * @type {boolean}
   */
  isAdminDrawerOpen: false,
  /**
   * Flash message to display
   * @type {null|{variant: string, message: string, placement?: string, title?: string, duration?: number}}
   */
  flashMessage: null,
};

/**
 * UI Slice
 *
 * Manages UI-related state such as drawer visibility, panel modes, redirect state, and flash messages.
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {},
  extraReducers: builder => {
    // Flash Message
    builder
      .addCase('FLASH_MESSAGE', (state, action) => {
        state.flashMessage = action.payload;
      })
      .addCase('FLASH_MESSAGE_CLEAR', state => {
        state.flashMessage = null;
      })
      // Shorthand actions for each variant
      .addCase('FLASH_MESSAGE_SUCCESS', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'success' };
      })
      .addCase('FLASH_MESSAGE_ERROR', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'error' };
      })
      .addCase('FLASH_MESSAGE_WARNING', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'warning' };
      })
      .addCase('FLASH_MESSAGE_INFO', (state, action) => {
        state.flashMessage = { ...action.payload, variant: 'info' };
      });

    // Admin Drawer
    builder.addCase('TOGGLE_ADMIN_DRAWER', state => {
      state.isAdminDrawerOpen = !state.isAdminDrawerOpen;
    });
  },
});

export default uiSlice.reducer;
