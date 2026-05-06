/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSelector } from '@reduxjs/toolkit';

import { normalizeState, SLICE_NAME } from './slice.js';

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
 * Get extensions data from state
 */
const getExtensionsState = state => {
  const normalized = normalizeState(state && state[SLICE_NAME]);
  return normalized.data;
};

// =============================================================================
// DATA SELECTORS
// =============================================================================

const getRawExtensions = state => {
  const data = getExtensionsState(state);
  return (data && data.extensions) || [];
};

export const getExtensions = createSelector([getRawExtensions], extensions =>
  extensions.slice().sort((a, b) => {
    const nameA = (a.name || a.key || '').toLowerCase();
    const nameB = (b.name || b.key || '').toLowerCase();
    return nameA.localeCompare(nameB);
  }),
);

export const isExtensionsInitialized = state => {
  const data = getExtensionsState(state);
  return !!(data && data.initialized);
};

// =============================================================================
// LIST OPERATION
// =============================================================================

export const isExtensionsListLoading = state => {
  const op = getOperationState(state, 'list');
  return !!(op && op.loading);
};

export const getExtensionsListError = state => {
  const op = getOperationState(state, 'list');
  return (op && op.error) || null;
};

// =============================================================================
// UPLOAD OPERATION
// =============================================================================

export const isExtensionUploading = state => {
  const op = getOperationState(state, 'upload');
  return !!(op && op.loading);
};

export const getExtensionUploadError = state => {
  const op = getOperationState(state, 'upload');
  return (op && op.error) || null;
};

// =============================================================================
// TOGGLE STATUS OPERATION
// =============================================================================

export const isExtensionToggling = state => {
  const op = getOperationState(state, 'toggleStatus');
  return !!(op && op.loading);
};

export const getExtensionToggleError = state => {
  const op = getOperationState(state, 'toggleStatus');
  return (op && op.error) || null;
};

// =============================================================================
// UNINSTALL OPERATION
// =============================================================================

export const isExtensionUninstalling = state => {
  const op = getOperationState(state, 'uninstall');
  return !!(op && op.loading);
};

export const getExtensionUninstallError = state => {
  const op = getOperationState(state, 'uninstall');
  return (op && op.error) || null;
};
