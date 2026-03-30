/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Basic selectors for the files slice
export const selectFilesState = state => state.files;

export const selectCurrentView = state =>
  (state.files && state.files.currentView) || 'my_drive';
export const selectCurrentFolderId = state =>
  (state.files && state.files.currentFolderId) || null;
export const selectBreadcrumbs = state =>
  (state.files && state.files.breadcrumbs) || [];
export const selectFiles = state => (state.files && state.files.files) || [];
export const selectCurrentFolder = state =>
  (state.files && state.files.currentFolder) || null;
export const selectSelectedFileIds = state =>
  (state.files && state.files.selectedFileIds) || [];
export const selectViewMode = state =>
  (state.files && state.files.viewMode) || 'grid';
export const selectLoadingFiles = state =>
  (state.files && state.files.loadingFiles) || false;
export const selectInitializedFiles = state =>
  (state.files && state.files.initializedFiles) || false;
export const selectError = state => (state.files && state.files.error) || null;
export const selectUploadModalOpen = state =>
  (state.files && state.files.uploadModalOpen) || false;
export const selectActiveUploads = state => state.files.activeUploads;
export const selectSearch = state => (state.files && state.files.search) || '';
export const selectPage = state => (state.files && state.files.page) || 1;
export const selectPageSize = state =>
  (state.files && state.files.pageSize) || 50;
export const selectTotalItems = state =>
  (state.files && state.files.total) || 0;

// Derived selector
export const selectSelectedFilesData = state => {
  const fileList = (state.files && state.files.files) || [];
  const selectedIds = (state.files && state.files.selectedFileIds) || [];
  return fileList.filter(f => selectedIds.includes(f.id));
};
