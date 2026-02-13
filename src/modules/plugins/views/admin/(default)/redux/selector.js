/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { normalizeState, SLICE_NAME } from './slice';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely get nested property from state
 */
const getOperationState = (state, operationKey) => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  if (!normalized.operations) return null;
  return normalized.operations[operationKey] || null;
};

/**
 * Get plugins data from state
 */
const getPluginsState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

export const getPlugins = state => {
  const data = getPluginsState(state);
  return (data && data.plugins) || [];
};

export const isPluginsInitialized = state => {
  const data = getPluginsState(state);
  return !!(data && data.initialized);
};

// =============================================================================
// LIST OPERATION
// =============================================================================

export const isPluginsListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getPluginsListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// UPLOAD OPERATION
// =============================================================================

export const isPluginUploading = state => {
  const op = getOperationState(state, 'upload');
  return !!(op && op.loading);
};

export const getPluginUploadError = state => {
  const op = getOperationState(state, 'upload');
  return (op && op.error) || null;
};

// =============================================================================
// UPGRADE OPERATION
// =============================================================================

export const isPluginUpgrading = state => {
  const op = getOperationState(state, 'upgrade');
  return !!(op && op.loading);
};

export const getPluginUpgradeError = state => {
  const op = getOperationState(state, 'upgrade');
  return (op && op.error) || null;
};

// =============================================================================
// TOGGLE STATUS OPERATION
// =============================================================================

export const isPluginToggling = state => {
  const op = getOperationState(state, 'toggleStatus');
  return !!(op && op.loading);
};

export const getPluginToggleError = state => {
  const op = getOperationState(state, 'toggleStatus');
  return (op && op.error) || null;
};

// =============================================================================
// UNINSTALL OPERATION
// =============================================================================

export const isPluginUninstalling = state => {
  const op = getOperationState(state, 'uninstall');
  return !!(op && op.loading);
};

export const getPluginUninstallError = state => {
  const op = getOperationState(state, 'uninstall');
  return (op && op.error) || null;
};
