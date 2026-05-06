/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import * as thunks from './thunks.js';

export const SLICE_NAME = 'files';

const initialState = {
  currentView: 'my_drive', // 'my_drive', 'recent', 'starred', 'trash'
  currentFolderId: null,
  breadcrumbs: [],
  files: [],
  currentFolder: null,
  selectedFileIds: [],
  viewMode: 'masonry', // 'masonry' | 'list'

  // Pagination & Search
  search: '',
  page: 1,
  pageSize: 50,
  total: 0,

  // Async states
  loadingFiles: false,
  loadingMore: false,
  initializedFiles: false,
  hasMore: true,
  error: null,

  // Upload UI State
  uploadModalOpen: false,
  activeUploads: [], // Array of { id, name, progress, status }

  // Storage usage
  storage: {
    used: 0,
    total: 100 * 1024 * 1024 * 1024, // Initial 100 GB
  },
};

export const filesSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    setView(state, action) {
      state.currentView = action.payload.view;
      state.currentFolderId = action.payload.folderId || null;
      state.selectedFileIds = [];
      state.error = null;
      state.hasMore = true;
      // Reset pagination and search on view change
      state.page = 1;
      state.search = '';
    },
    setSearch(state, action) {
      state.search = action.payload;
      state.page = 1; // Reset to first page on search
      state.hasMore = true;
    },
    setPage(state, action) {
      state.page = action.payload;
    },
    setPageSize(state, action) {
      state.pageSize = action.payload;
      state.page = 1; // Reset to first page on page size change
    },
    toggleSelection(state, action) {
      const { fileId, multi } = action.payload;
      if (multi) {
        if (state.selectedFileIds.includes(fileId)) {
          state.selectedFileIds = state.selectedFileIds.filter(
            id => id !== fileId,
          );
        } else {
          state.selectedFileIds.push(fileId);
        }
      } else {
        state.selectedFileIds = [fileId];
      }
    },
    clearSelection(state) {
      state.selectedFileIds = [];
    },
    setSelection(state, action) {
      state.selectedFileIds = action.payload;
    },
    setViewMode(state, action) {
      state.viewMode = action.payload; // 'masonry' or 'list'
      state.page = 1;
      state.hasMore = true;
    },
    setUploadModalOpen(state, action) {
      state.uploadModalOpen = action.payload;
    },
    addUploadItem(state, action) {
      state.activeUploads.push(action.payload);
    },
    updateUploadProgress(state, action) {
      const { id, progress, status, error } = action.payload;
      const upload = state.activeUploads.find(u => u.id === id);
      if (upload) {
        if (progress !== undefined) upload.progress = progress;
        if (status) upload.status = status;
        if (error) upload.error = error;
      }
    },
    clearCompletedUploads(state) {
      state.activeUploads = state.activeUploads.filter(
        u => u.status !== 'completed' && u.status !== 'error',
      );
    },
  },
  extraReducers: builder => {
    // Fetch Files
    builder.addCase(thunks.fetchFiles.pending, (state, action) => {
      const isAppend = action.meta && action.meta.arg && action.meta.arg.append;
      if (isAppend) {
        state.loadingMore = true;
      } else {
        state.loadingFiles = true;
        state.selectedFileIds = [];
      }
      state.error = null;
    });
    builder.addCase(thunks.fetchFiles.fulfilled, (state, action) => {
      const isAppend = action.meta && action.meta.arg && action.meta.arg.append;
      state.loadingFiles = false;
      state.loadingMore = false;
      state.initializedFiles = true;

      if (isAppend) {
        // Append new items to existing list
        state.files = state.files.concat(action.payload.files || []);
      } else {
        state.files = action.payload.files;
        state.currentFolder = action.payload.currentFolder;
        state.breadcrumbs = action.payload.breadcrumbs;
      }

      state.total = action.payload.total || 0;

      // Determine if there are more items to load
      const totalLoaded = state.files.length;
      state.hasMore = totalLoaded < state.total;
    });
    builder.addCase(thunks.fetchFiles.rejected, (state, action) => {
      state.loadingFiles = false;
      state.loadingMore = false;
      state.initializedFiles = true;
      state.error = action.error.message;
    });

    // Create Folder
    builder.addCase(thunks.createFolder.fulfilled, (state, action) => {
      state.files.unshift(action.payload.folder); // Add new folder at the beginning
    });

    // Rename
    builder.addCase(thunks.renameItem.fulfilled, (state, action) => {
      const index = state.files.findIndex(f => f.id === action.payload.file.id);
      if (index !== -1) {
        state.files[index] = action.payload.file;
      }
    });

    // Toggle Star
    builder.addCase(thunks.toggleStarItem.fulfilled, (state, action) => {
      const index = state.files.findIndex(f => f.id === action.payload.file.id);
      if (index !== -1) {
        state.files[index].is_starred = action.payload.file.is_starred;
      }
    });

    // Trash Item
    builder.addCase(thunks.trashItems.fulfilled, (state, action) => {
      // Remove trashed items from the current view unless we're IN the trash view
      if (state.currentView !== 'trash') {
        state.files = state.files.filter(
          f => !action.payload.ids.includes(f.id),
        );
        state.selectedFileIds = [];
      }
    });

    // Restore
    builder.addCase(thunks.restoreItems.fulfilled, (state, action) => {
      if (state.currentView === 'trash') {
        state.files = state.files.filter(
          f => !action.payload.ids.includes(f.id),
        );
        state.selectedFileIds = [];
      }
    });

    // Permanent Delete
    builder.addCase(
      thunks.deleteItemsPermanently.fulfilled,
      (state, action) => {
        state.files = state.files.filter(
          f => !action.payload.ids.includes(f.id),
        );
        state.selectedFileIds = [];
      },
    );

    // Empty Trash
    builder.addCase(thunks.emptyTrash.fulfilled, state => {
      if (state.currentView === 'trash') {
        state.files = [];
        state.selectedFileIds = [];
      }
    });

    // Update Sharing
    builder.addCase(thunks.updateSharing.fulfilled, (state, action) => {
      const index = state.files.findIndex(f => f.id === action.payload.file.id);
      if (index !== -1) {
        state.files[index].share_type = action.payload.file.share_type;
      }
    });

    // Fetch Storage
    builder.addCase(thunks.fetchStorageUsage.fulfilled, (state, action) => {
      state.storage = action.payload;
    });
  },
});

export const {
  setView,
  toggleSelection,
  clearSelection,
  setSelection,
  setViewMode,
  setUploadModalOpen,
  addUploadItem,
  updateUploadProgress,
  clearCompletedUploads,
  setSearch,
  setPage,
  setPageSize,
} = filesSlice.actions;

export default filesSlice.reducer;
