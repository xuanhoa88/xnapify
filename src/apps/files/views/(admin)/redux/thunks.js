/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

const ADMIN_API_BASE = '/api/admin/files';

// =========================================================================
// THUNKS
// =========================================================================

export const fetchFiles = createAsyncThunk(
  'admin/files/fetchFiles',
  async (
    {
      view = 'my_drive',
      parentId = null,
      search = '',
      page = 1,
      pageSize = 50,
    } = {},
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(ADMIN_API_BASE, {
        query: {
          view,
          parentId: parentId || undefined,
          search: search || undefined,
          page,
          pageSize,
        },
      });
      return data; // { files, currentFolder, breadcrumbs, total }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const createFolder = createAsyncThunk(
  'admin/files/createFolder',
  async ({ name, parentId }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/folder`, {
        method: 'POST',
        body: { name, parentId },
      });
      return data; // { folder }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const renameItem = createAsyncThunk(
  'admin/files/renameItem',
  async ({ id, name }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/${id}/rename`, {
        method: 'PUT',
        body: { name },
      });
      return data; // { file }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const moveItems = createAsyncThunk(
  'admin/files/moveItems',
  async (
    { ids, parentId },
    { dispatch, getState, extra: { fetch }, rejectWithValue },
  ) => {
    try {
      // We update multiple but the API takes one. We run in parallel
      await Promise.all(
        ids.map(id =>
          fetch(`${ADMIN_API_BASE}/${id}/move`, {
            method: 'PUT',
            body: { parentId },
          }),
        ),
      );

      // Rather than returning payload, we just re-fetch the current view
      const state = getState().files;
      dispatch(
        fetchFiles({
          view: state.currentView,
          parentId: state.currentFolderId,
        }),
      );
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const toggleStarItem = createAsyncThunk(
  'admin/files/toggleStarItem',
  async ({ id, isStarred }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/${id}/star`, {
        method: 'PUT',
        body: { isStarred },
      });
      return data; // { file }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const trashItems = createAsyncThunk(
  'admin/files/trashItems',
  async (ids, { dispatch, getState, extra: { fetch }, rejectWithValue }) => {
    try {
      await Promise.all(
        ids.map(id =>
          fetch(`${ADMIN_API_BASE}/${id}`, {
            method: 'DELETE',
          }),
        ),
      );

      // Re-fetch the current view and storage
      const state = getState().files;
      dispatch(
        fetchFiles({
          view: state.currentView,
          parentId: state.currentFolderId,
        }),
      );
      dispatch(fetchStorageUsage());

      return { ids };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const restoreItems = createAsyncThunk(
  'admin/files/restoreItems',
  async (ids, { dispatch, getState, extra: { fetch }, rejectWithValue }) => {
    try {
      await Promise.all(
        ids.map(id =>
          fetch(`${ADMIN_API_BASE}/${id}/restore`, {
            method: 'POST',
          }),
        ),
      );

      const state = getState().files;
      dispatch(
        fetchFiles({
          view: state.currentView,
          parentId: state.currentFolderId,
        }),
      );
      dispatch(fetchStorageUsage());

      return { ids };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const deleteItemsPermanently = createAsyncThunk(
  'admin/files/deleteItemsPermanently',
  async (ids, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      await Promise.all(
        ids.map(id =>
          fetch(`${ADMIN_API_BASE}/${id}/permanent`, {
            method: 'DELETE',
          }),
        ),
      );
      dispatch(fetchStorageUsage());
      return { ids };
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const emptyTrash = createAsyncThunk(
  'admin/files/emptyTrash',
  async (_, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`${ADMIN_API_BASE}/trash/empty`, {
        method: 'DELETE',
      });
      dispatch(fetchStorageUsage());
      return true;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const updateSharing = createAsyncThunk(
  'admin/files/updateSharing',
  async ({ id, shareType, shares }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/${id}/share`, {
        method: 'PUT',
        body: { shareType, shares },
      });
      return data; // { file }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const fetchFileShares = createAsyncThunk(
  'admin/files/fetchFileShares',
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/${id}/shares`);
      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const uploadFile = createAsyncThunk(
  'admin/files/uploadFile',
  async (formData, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      // Note: We use the raw fetch options for FormData to let the browser
      // set the correct Content-Type with the multipart boundary
      const { data } = await fetch(`${ADMIN_API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      dispatch(fetchStorageUsage());
      return data; // { file }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const fetchStorageUsage = createAsyncThunk(
  'admin/files/fetchStorageUsage',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/storage`);
      return data; // { used, total }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

export const searchUsersAndGroups = createAsyncThunk(
  'admin/files/searchUsersAndGroups',
  async (query, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/search', {
        query: { q: query },
      });

      return data; // { query, results, count }
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
