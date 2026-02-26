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
 * Retrieves webhook activity logs with pagination support.
 *
 * @param {Object} options - Fetch options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.limit - Items per page
 * @returns {Promise<Object>} Activity data with pagination
 */
export const fetchActivities = createAsyncThunk(
  'admin/dashboard/fetchActivities',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { page = 1, limit = 20, search = '' } = options;
      const offset = (page - 1) * limit;

      const query = { limit, offset };
      if (search) query.search = search;

      const { data } = await fetch('/api/admin/activities', {
        query,
      });

      // Extract data from standard response format
      // Response: { success: true, data: { webhooks: [], total: 100 } }
      const { webhooks = [], total = 0 } = data || {};

      // Calculate pagination metadata
      const hasMore = offset + limit < total;

      return {
        data: webhooks,
        total,
        page,
        limit,
        offset,
        hasMore,
      };
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch dashboard data');
    }
  },
);
