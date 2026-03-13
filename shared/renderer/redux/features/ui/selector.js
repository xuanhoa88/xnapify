/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSelector } from '@reduxjs/toolkit';

import { normalizeState } from './utils';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const selectUiRaw = state => state && state.ui;

/**
 * Safely get UI state with normalization
 *
 * @param {Object} state - Redux state
 * @returns {Object} Normalized UI state
 */
const getUiState = createSelector([selectUiRaw], ui => normalizeState(ui));

// =============================================================================
// DRAWER SELECTORS
// =============================================================================

/**
 * Check if a drawer is open for a given namespace
 *
 * @param {Object} state - Redux state
 * @param {string} namespace - Namespace of the drawer (default: 'default')
 * @returns {boolean} Whether the drawer is open
 */
export const isDrawerOpen = (state, namespace = 'default') => {
  const ui = getUiState(state);
  return Boolean(ui.drawers && ui.drawers[namespace]);
};

// =============================================================================
// FLASH MESSAGE SELECTORS
// =============================================================================

/**
 * Get current flash message
 *
 * @param {Object} state - Redux state
 * @returns {Object|null} Flash message object or null
 */
export const getFlashMessage = state => {
  const ui = getUiState(state);
  return ui.flashMessage;
};

/**
 * Check if there is an active flash message
 *
 * @param {Object} state - Redux state
 * @returns {boolean} Whether there is an active flash message
 */
export const hasFlashMessage = state => {
  const message = getFlashMessage(state);
  return message !== null;
};

/**
 * Get flash message variant
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Flash message variant or null
 */
export const getFlashMessageVariant = state => {
  const message = getFlashMessage(state);
  return message && message.variant ? message.variant : null;
};

/**
 * Get flash message text
 *
 * @param {Object} state - Redux state
 * @returns {string|null} Flash message text or null
 */
export const getFlashMessageText = state => {
  const message = getFlashMessage(state);
  return message && message.message ? message.message : null;
};

// =============================================================================
// BREADCRUMB SELECTORS
// =============================================================================

/**
 * Get all breadcrumbs (object keyed by namespace)
 *
 * @param {Object} state - Redux state
 * @returns {Object} Breadcrumbs object { namespace: [...items] }
 */
export const getAllBreadcrumbs = createSelector(
  [getUiState],
  ui => ui.breadcrumbs || {},
);

/**
 * Get breadcrumbs for 'admin' namespace (convenience selector)
 *
 * @param {Object} state - Redux state
 * @param {string} ns - Namespace to get breadcrumbs for
 * @returns {Array<{ label: string, url?: string }>} Admin breadcrumbs array
 */
export const getBreadcrumbs = (state, ns = 'admin') => {
  const breadcrumbs = getAllBreadcrumbs(state);
  return breadcrumbs[ns] || [];
};
