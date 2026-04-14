import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchPublicSettings = createAsyncThunk(
  'settings/fetchPublic',
  async (_, { extra: { fetch } }) => {
    const { data } = await fetch('/api/settings/public');
    return data;
  },
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {},
  reducers: {},
  extraReducers: builder => {
    builder.addCase(fetchPublicSettings.fulfilled, (state, action) => {
      return action.payload;
    });
  },
});

export const selectSetting = (state, key) =>
  state.settings && state.settings[key];

export default settingsSlice.reducer;
