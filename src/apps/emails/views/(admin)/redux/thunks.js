/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Email Templates Thunks
 *
 * Async thunk actions for admin email templates CRUD operations.
 */

/**
 * Fetch all email templates with pagination and filters
 */
export const fetchTemplates = createAsyncThunk(
  'admin/emails/fetchTemplates',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { page = 1, limit = 20, search = '', status = '' } = options || {};

      const { data } = await fetch('/api/admin/emails/templates', {
        query: {
          page,
          limit,
          search,
          status,
        },
      });

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Fetch a single email template by ID
 */
export const fetchTemplateById = createAsyncThunk(
  'admin/emails/fetchTemplateById',
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(`/api/admin/emails/templates/${id}`);
      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Create a new email template
 */
export const createTemplate = createAsyncThunk(
  'admin/emails/createTemplate',
  async (templateData, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/admin/emails/templates', {
        method: 'POST',
        body: templateData,
      });

      dispatch(fetchTemplates());

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Update an existing email template
 */
export const updateTemplate = createAsyncThunk(
  'admin/emails/updateTemplate',
  async (
    { id, templateData },
    { dispatch, extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch(`/api/admin/emails/templates/${id}`, {
        method: 'PUT',
        body: templateData,
      });

      dispatch(fetchTemplates());

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Delete a single email template
 */
export const deleteTemplate = createAsyncThunk(
  'admin/emails/deleteTemplate',
  async (id, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch(`/api/admin/emails/templates/${id}`, {
        method: 'DELETE',
      });

      return id;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Bulk-delete email templates
 */
export const bulkDeleteTemplates = createAsyncThunk(
  'admin/emails/bulkDeleteTemplates',
  async (ids, { extra: { fetch }, rejectWithValue }) => {
    try {
      await fetch('/api/admin/emails/templates', {
        method: 'DELETE',
        body: { ids },
      });

      return ids;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Preview a saved email template
 */
export const previewTemplate = createAsyncThunk(
  'admin/emails/previewTemplate',
  async ({ id, sampleData }, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(
        `/api/admin/emails/templates/${id}/preview`,
        {
          method: 'POST',
          body: { sample_data: sampleData },
        },
      );

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Preview raw template content (without saving)
 */
export const previewRawTemplate = createAsyncThunk(
  'admin/emails/previewRawTemplate',
  async (
    { subject, html_body, text_body, sample_data },
    { extra: { fetch }, rejectWithValue },
  ) => {
    try {
      const { data } = await fetch('/api/admin/emails/templates/preview', {
        method: 'POST',
        body: { subject, html_body, text_body, sample_data },
      });

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);

/**
 * Duplicate an email template
 */
export const duplicateTemplate = createAsyncThunk(
  'admin/emails/duplicateTemplate',
  async (id, { dispatch, extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch(
        `/api/admin/emails/templates/${id}/duplicate`,
        {
          method: 'POST',
        },
      );

      dispatch(fetchTemplates());

      return data;
    } catch (error) {
      return rejectWithValue(
        (error.data && error.data.message) || error.message,
      );
    }
  },
);
