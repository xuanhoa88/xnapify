/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Dashboard Thunks
 */

/**
 * Fetch dashboard statistics and recent activity
 *
 * Retrieves system-wide statistics including user counts, role counts,
 * system status, and recent user activity.
 */
export const fetchDashboard = createAsyncThunk(
  'admin/dashboard/fetchDashboard',
  async (_, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/users/dashboard');
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
