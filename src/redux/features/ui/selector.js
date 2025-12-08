/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Check if sidebar is open
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if sidebar is open
 */
export const isSidebarOpen = state => state.ui.sidebarOpen;

/**
 * Check if current page is admin panel
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if in admin panel
 */
export const isAdminPanel = state => state.ui.isAdminPanel;

/**
 * Check if should show page header
 *
 * @param {Object} state - Redux state
 * @returns {boolean} True if page header should be shown
 */
export const shouldShowPageHeader = state => state.ui.showPageHeader;
