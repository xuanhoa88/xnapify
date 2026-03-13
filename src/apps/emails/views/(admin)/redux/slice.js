/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createSlice } from '@reduxjs/toolkit';

import {
  fetchTemplates,
  fetchTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  bulkDeleteTemplates,
  previewTemplate,
  previewRawTemplate,
  duplicateTemplate,
} from './thunks';

/**
 * Admin Email Templates Slice
 *
 * State shape:
 * {
 *   data: {
 *     templates: [...],
 *     pagination: { total, page, limit, pages } | null,
 *     currentTemplate: Object | null,
 *     initialized: { list: boolean, detail: boolean },
 *   },
 *   preview: {
 *     subject: string,
 *     html: string,
 *     text: string,
 *   },
 *   operations: {
 *     list: { loading, error },
 *     detail: { loading, error },
 *     create: { loading, error },
 *     update: { loading, error },
 *     delete: { loading, error },
 *     bulkDelete: { loading, error },
 *     preview: { loading, error },
 *     duplicate: { loading, error },
 *   }
 * }
 */

const createOperationState = () => ({ loading: false, error: null });

const createFreshOperations = () => ({
  list: createOperationState(),
  detail: createOperationState(),
  create: createOperationState(),
  update: createOperationState(),
  delete: createOperationState(),
  bulkDelete: createOperationState(),
  preview: createOperationState(),
  duplicate: createOperationState(),
});

const createFreshData = () => ({
  templates: [],
  pagination: null,
  currentTemplate: null,
  initialized: {
    list: false,
    detail: false,
  },
});

const createFreshPreview = () => ({
  subject: '',
  html: '',
  text: '',
});

const initialState = {
  data: createFreshData(),
  preview: createFreshPreview(),
  operations: createFreshOperations(),
};

export const normalizeState = state => {
  if (!state || typeof state !== 'object') {
    return {
      data: createFreshData(),
      preview: createFreshPreview(),
      operations: createFreshOperations(),
    };
  }

  if ('operations' in state) {
    return {
      data: state.data || createFreshData(),
      preview: state.preview || createFreshPreview(),
      operations: { ...createFreshOperations(), ...state.operations },
    };
  }

  return {
    data: createFreshData(),
    preview: createFreshPreview(),
    operations: createFreshOperations(),
  };
};

const createPendingHandler = operationKey => state => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = { loading: true, error: null };
  Object.assign(state, normalized);
};

const createRejectedHandler = operationKey => (state, action) => {
  const normalized = normalizeState(state);
  normalized.operations[operationKey] = {
    loading: false,
    error:
      action.payload ||
      (action.error && action.error.message) ||
      'An error occurred',
  };
  Object.assign(state, normalized);
};

/**
 * Slice name constant
 */
export const SLICE_NAME = '@admin/emails';

const emailTemplatesSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearListError: state => {
      const normalized = normalizeState(state);
      normalized.operations.list.error = null;
      Object.assign(state, normalized);
    },
    clearDetailError: state => {
      const normalized = normalizeState(state);
      normalized.operations.detail.error = null;
      Object.assign(state, normalized);
    },
    clearCreateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.create.error = null;
      Object.assign(state, normalized);
    },
    clearUpdateError: state => {
      const normalized = normalizeState(state);
      normalized.operations.update.error = null;
      Object.assign(state, normalized);
    },
    clearDeleteError: state => {
      const normalized = normalizeState(state);
      normalized.operations.delete.error = null;
      Object.assign(state, normalized);
    },
    clearPreview: state => {
      const normalized = normalizeState(state);
      normalized.preview = createFreshPreview();
      normalized.operations.preview.error = null;
      Object.assign(state, normalized);
    },
    resetState: () => initialState,
  },
  extraReducers: builder => {
    // =========================================================================
    // FETCH TEMPLATES LIST
    // =========================================================================
    builder
      .addCase(fetchTemplates.pending, createPendingHandler('list'))
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const payload = action.payload || {};
        normalized.data.templates = payload.templates || [];
        normalized.data.pagination = payload.pagination || null;
        normalized.data.initialized.list = true;
        normalized.operations.list = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchTemplates.rejected, createRejectedHandler('list'));

    // =========================================================================
    // FETCH TEMPLATE BY ID
    // =========================================================================
    builder
      .addCase(fetchTemplateById.pending, state => {
        const normalized = normalizeState(state);
        normalized.data.currentTemplate = null;
        normalized.data.initialized.detail = false;
        normalized.operations.detail = { loading: true, error: null };
        Object.assign(state, normalized);
      })
      .addCase(fetchTemplateById.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.currentTemplate = action.payload;
        normalized.data.initialized.detail = true;
        normalized.operations.detail = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(fetchTemplateById.rejected, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.currentTemplate = null;
        normalized.data.initialized.detail = true;
        normalized.operations.detail = {
          loading: false,
          error:
            action.payload ||
            (action.error && action.error.message) ||
            'An error occurred',
        };
        Object.assign(state, normalized);
      });

    // =========================================================================
    // CREATE TEMPLATE
    // =========================================================================
    builder
      .addCase(createTemplate.pending, createPendingHandler('create'))
      .addCase(createTemplate.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (action.payload) {
          normalized.data.templates.unshift(action.payload);
        }
        normalized.operations.create = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(createTemplate.rejected, createRejectedHandler('create'));

    // =========================================================================
    // UPDATE TEMPLATE
    // =========================================================================
    builder
      .addCase(updateTemplate.pending, createPendingHandler('update'))
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        const index = normalized.data.templates.findIndex(
          t => t.id === action.payload.id,
        );
        if (index !== -1) {
          normalized.data.templates[index] = {
            ...normalized.data.templates[index],
            ...action.payload,
          };
        }
        normalized.data.currentTemplate = action.payload;
        normalized.operations.update = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(updateTemplate.rejected, createRejectedHandler('update'));

    // =========================================================================
    // DELETE TEMPLATE
    // =========================================================================
    builder
      .addCase(deleteTemplate.pending, createPendingHandler('delete'))
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.templates = normalized.data.templates.filter(
          t => t.id !== action.payload,
        );
        normalized.operations.delete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(deleteTemplate.rejected, createRejectedHandler('delete'));

    // =========================================================================
    // BULK DELETE TEMPLATES
    // =========================================================================
    builder
      .addCase(bulkDeleteTemplates.pending, createPendingHandler('bulkDelete'))
      .addCase(bulkDeleteTemplates.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.data.templates = normalized.data.templates.filter(
          t => !action.payload.includes(t.id),
        );
        normalized.operations.bulkDelete = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(
        bulkDeleteTemplates.rejected,
        createRejectedHandler('bulkDelete'),
      );

    // =========================================================================
    // PREVIEW TEMPLATE (saved or raw)
    // =========================================================================
    builder
      .addCase(previewTemplate.pending, createPendingHandler('preview'))
      .addCase(previewTemplate.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.preview = action.payload;
        normalized.operations.preview = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(previewTemplate.rejected, createRejectedHandler('preview'));

    builder
      .addCase(previewRawTemplate.pending, createPendingHandler('preview'))
      .addCase(previewRawTemplate.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        normalized.preview = action.payload;
        normalized.operations.preview = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(previewRawTemplate.rejected, createRejectedHandler('preview'));

    // =========================================================================
    // DUPLICATE TEMPLATE
    // =========================================================================
    builder
      .addCase(duplicateTemplate.pending, createPendingHandler('duplicate'))
      .addCase(duplicateTemplate.fulfilled, (state, action) => {
        const normalized = normalizeState(state);
        if (action.payload) {
          normalized.data.templates.unshift(action.payload);
        }
        normalized.operations.duplicate = createOperationState();
        Object.assign(state, normalized);
      })
      .addCase(duplicateTemplate.rejected, createRejectedHandler('duplicate'));
  },
});

export const {
  clearListError,
  clearDetailError,
  clearCreateError,
  clearUpdateError,
  clearDeleteError,
  clearPreview,
  resetState,
} = emailTemplatesSlice.actions;

export default emailTemplatesSlice.reducer;
