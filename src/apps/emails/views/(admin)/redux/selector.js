/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SLICE_NAME, normalizeState } from './slice';

/**
 * Base selector — get the normalized slice state
 */
const selectSlice = state => normalizeState(state[SLICE_NAME]);

// =============================================================================
// DATA SELECTORS
// =============================================================================

export const getTemplates = state => selectSlice(state).data.templates;
export const getTemplatePagination = state =>
  selectSlice(state).data.pagination;
export const getCurrentTemplate = state =>
  selectSlice(state).data.currentTemplate;
export const isListInitialized = state =>
  selectSlice(state).data.initialized.list;
export const isDetailInitialized = state =>
  selectSlice(state).data.initialized.detail;

// =============================================================================
// PREVIEW SELECTORS
// =============================================================================

export const getPreviewHtml = state => selectSlice(state).preview.html;
export const getPreviewSubject = state => selectSlice(state).preview.subject;
export const getPreviewText = state => selectSlice(state).preview.text;
export const getPreview = state => selectSlice(state).preview;

// =============================================================================
// OPERATION SELECTORS
// =============================================================================

export const isListLoading = state =>
  selectSlice(state).operations.list.loading;
export const getListError = state => selectSlice(state).operations.list.error;

export const isDetailLoading = state =>
  selectSlice(state).operations.detail.loading;
export const getDetailError = state =>
  selectSlice(state).operations.detail.error;

export const isCreateLoading = state =>
  selectSlice(state).operations.create.loading;
export const getCreateError = state =>
  selectSlice(state).operations.create.error;

export const isUpdateLoading = state =>
  selectSlice(state).operations.update.loading;
export const getUpdateError = state =>
  selectSlice(state).operations.update.error;

export const isDeleteLoading = state =>
  selectSlice(state).operations.delete.loading;
export const getDeleteError = state =>
  selectSlice(state).operations.delete.error;

export const isPreviewLoading = state =>
  selectSlice(state).operations.preview.loading;
export const getPreviewError = state =>
  selectSlice(state).operations.preview.error;

export const isDuplicateLoading = state =>
  selectSlice(state).operations.duplicate.loading;
