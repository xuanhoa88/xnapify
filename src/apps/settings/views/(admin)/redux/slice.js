import { createSlice } from '@reduxjs/toolkit';

import { fetchSettings, saveNamespaceSettings } from './thunks';

export const SLICE_NAME = '@settings/admin';

const initialState = {
  /** @type {Object<string, Array>} Namespace → settings array */
  groups: {},
  loading: false,
  initialized: false,
  saving: false,
  error: null,
};

const slice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // ── fetch ───────────────────────────────────────────────────────────
      .addCase(fetchSettings.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.groups = action.payload;
        state.loading = false;
        state.initialized = true;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
        state.initialized = true; // Still mark initialized on error to show empty state/errors
      })
      // ── save ────────────────────────────────────────────────────────────
      .addCase(saveNamespaceSettings.pending, state => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveNamespaceSettings.fulfilled, (state, action) => {
        // Merge updated settings back into groups
        const updated = action.payload;
        for (const item of updated) {
          const ns = item.namespace;
          if (state.groups[ns]) {
            const idx = state.groups[ns].findIndex(
              s => s.key === item.key && s.namespace === item.namespace,
            );
            if (idx >= 0) {
              state.groups[ns][idx] = item;
            }
          }
        }
        state.saving = false;
      })
      .addCase(saveNamespaceSettings.rejected, (state, action) => {
        state.error = action.payload;
        state.saving = false;
      });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;
