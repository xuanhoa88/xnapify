/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
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
    { view = 'my_drive', parentId = null } = {},
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(ADMIN_API_BASE, {
        query: {
          view,
          parentId: parentId || undefined,
        },
      });
      return data; // { files, currentFolder, breadcrumbs }
    } catch (error) {
      return rejectWithValue(error.message);
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
      return rejectWithValue(error.message);
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
      return rejectWithValue(error.message);
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
      return rejectWithValue(error.message);
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
      return rejectWithValue(error.message);
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

      // Re-fetch the current view so the trash operation is reflected in the UI
      const state = getState().files;
      dispatch(
        fetchFiles({
          view: state.currentView,
          parentId: state.currentFolderId,
        }),
      );

      return { ids };
    } catch (error) {
      return rejectWithValue(error.message);
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

      return { ids };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const deleteItemsPermanently = createAsyncThunk(
  'admin/files/deleteItemsPermanently',
  async (ids, { extra: { fetch }, rejectWithValue }) => {
    try {
      await Promise.all(
        ids.map(id =>
          fetch(`${ADMIN_API_BASE}/${id}/permanent`, {
            method: 'DELETE',
          }),
        ),
      );
      return { ids };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const emptyTrash = createAsyncThunk(
  'admin/files/emptyTrash',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`${ADMIN_API_BASE}/trash/empty`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateSharing = createAsyncThunk(
  'admin/files/updateSharing',
  async ({ id, shareType }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`${ADMIN_API_BASE}/${id}/share`, {
        method: 'PUT',
        body: { shareType },
      });
      return data; // { file }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const uploadFile = createAsyncThunk(
  'admin/files/uploadFile',
  async (formData, { extra: { fetch }, rejectWithValue }) => {
    try {
      // Note: We use the raw fetch options for FormData to let the browser
      // set the correct Content-Type with the multipart boundary
      const { data } = await fetch(`${ADMIN_API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      return data; // { file }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
