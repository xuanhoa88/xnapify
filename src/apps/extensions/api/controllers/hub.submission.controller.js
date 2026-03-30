/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as submissionService from '../services/hub.submission.service';

// ========================================================================
// HUB SUBMISSION CONTROLLERS — Admin review workflow
// ========================================================================

/**
 * Submit extension for review
 *
 * @route POST /api/admin/extensions/hub/submit
 */
export const submitExtension = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const submission = await submissionService.submitExtension(
      {
        models: container.resolve('models'),
        fsEngine: container.resolve('fs'),
      },
      {
        name: req.body.name,
        key: req.body.key,
        description: req.body.description,
        short_description: req.body.short_description,
        category: req.body.category,
        tags: req.body.tags,
        version: req.body.version,
        file: req.file,
        submitterId: req.user.id,
      },
    );
    return http.sendSuccess(res, { submission }, 201);
  } catch (err) {
    return http.sendServerError(res, 'Failed to submit extension', err);
  }
};

/**
 * List current user's submissions
 *
 * @route GET /api/admin/extensions/hub/my
 */
export const listMySubmissions = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const submissions = await submissionService.listMySubmissions(
      { models: container.resolve('models') },
      req.user.id,
    );
    return http.sendSuccess(res, { submissions });
  } catch (err) {
    return http.sendServerError(res, 'Failed to list submissions', err);
  }
};

/**
 * List submissions for admin review
 *
 * @route GET /api/admin/extensions/hub/submissions
 */
export const listSubmissions = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const result = await submissionService.listSubmissions(
      { models: container.resolve('models') },
      {
        status: req.query.status || 'pending',
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
      },
    );
    return http.sendSuccess(res, result);
  } catch (err) {
    return http.sendServerError(res, 'Failed to list submissions', err);
  }
};

/**
 * Get submission detail
 *
 * @route GET /api/admin/extensions/hub/submissions/:id
 */
export const getSubmissionDetail = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const submission = await submissionService.getSubmissionDetail(
      { models: container.resolve('models') },
      req.params.id,
    );
    return http.sendSuccess(res, { submission });
  } catch (err) {
    if (err.status === 404) {
      return http.sendError(res, err.message, 404);
    }
    return http.sendServerError(res, 'Failed to get submission', err);
  }
};

/**
 * Approve or reject a submission
 *
 * @route PATCH /api/admin/extensions/hub/submissions/:id
 */
export const reviewSubmission = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const { action, notes } = req.body;

    if (action === 'approve') {
      const result = await submissionService.approveSubmission(
        {
          models: container.resolve('models'),
          fsEngine: container.resolve('fs'),
        },
        req.params.id,
        req.user.id,
        notes,
      );
      return http.sendSuccess(res, result);
    }

    if (action === 'reject') {
      if (!notes) {
        return http.sendError(res, 'Rejection notes are required', 400);
      }
      const submission = await submissionService.rejectSubmission(
        { models: container.resolve('models') },
        req.params.id,
        req.user.id,
        notes,
      );
      return http.sendSuccess(res, { submission });
    }

    return http.sendError(
      res,
      'Invalid action. Use "approve" or "reject"',
      400,
    );
  } catch (err) {
    if (err.status === 404 || err.status === 400) {
      return http.sendError(res, err.message, err.status);
    }
    return http.sendServerError(res, 'Failed to review submission', err);
  }
};

/**
 * Remove a listing
 *
 * @route DELETE /api/admin/extensions/hub/listings/:id
 */
export const removeListing = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    await submissionService.removeListing(
      { models: container.resolve('models') },
      req.params.id,
    );
    return http.sendSuccess(res, { message: 'Listing removed' });
  } catch (err) {
    if (err.status === 404) {
      return http.sendError(res, err.message, 404);
    }
    return http.sendServerError(res, 'Failed to remove listing', err);
  }
};

/**
 * Update listing metadata
 *
 * @route PATCH /api/admin/extensions/hub/listings/:id
 */
export const updateListing = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  try {
    const listing = await submissionService.updateListing(
      { models: container.resolve('models') },
      req.params.id,
      req.body,
    );
    return http.sendSuccess(res, { listing });
  } catch (err) {
    if (err.status === 404) {
      return http.sendError(res, err.message, 404);
    }
    return http.sendServerError(res, 'Failed to update listing', err);
  }
};
