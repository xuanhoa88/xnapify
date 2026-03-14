/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Activity Redux Thunks
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Fetch activities logs with pagination and filters
 */
export const fetchActivities = createAsyncThunk(
  'admin/activities/fetchActivities',
  async (
    { page = 1, limit = 20, event, entity_type } = {},
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const query = { page, limit };
      if (event) query.event = event;
      if (entity_type) query.entity_type = entity_type;

      const { data } = await fetch('/api/admin/activities', { query });
      return data;
    } catch (error) {
      return rejectWithValue(error.data || error.message);
    }
  },
);
