/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// Hub Submission Service — Submit & Review Workflow
// ========================================================================

/**
 * Submit an extension for review.
 *
 * @param {Object} deps - { models, fsEngine }
 * @param {Object} data - { name, key, description, short_description, category, tags, version, file, submitterId }
 * @returns {Object} Created submission
 */
export async function submitExtension({ models, fsEngine }, data) {
  const { MarketplaceSubmission, MarketplaceListing } = models;

  // Check if a listing already exists for this key (version update)
  const existingListing = await MarketplaceListing.findOne({
    where: { key: data.key },
  });

  // Store the uploaded package via fs engine
  const packagePath = await fsEngine.store(data.file, {
    directory: 'marketplace/submissions',
    filename: `${data.key}-${data.version}-${Date.now()}.zip`,
  });

  const submission = await MarketplaceSubmission.create({
    listing_id: existingListing ? existingListing.id : null,
    name: data.name,
    key: data.key,
    description: data.description || '',
    short_description: data.short_description || '',
    category: data.category || 'other',
    tags: data.tags || [],
    version: data.version,
    package_path: packagePath,
    submitter_id: data.submitterId,
    status: 'pending',
  });

  return submission;
}

/**
 * List current user's submissions.
 *
 * @param {Object} deps - { models }
 * @param {string} submitterId - User UUID
 * @returns {Array} Submissions
 */
export async function listMySubmissions({ models }, submitterId) {
  const { MarketplaceSubmission, MarketplaceListing, User: _User } = models;

  return MarketplaceSubmission.findAll({
    where: { submitter_id: submitterId },
    include: [
      MarketplaceListing
        ? {
            model: MarketplaceListing,
            as: 'listing',
            attributes: ['id', 'name', 'key', 'status'],
          }
        : null,
    ].filter(Boolean),
    order: [['created_at', 'DESC']],
  });
}

/**
 * List submissions for admin review.
 *
 * @param {Object} deps - { models }
 * @param {Object} params - { status, page, limit }
 * @returns {Object} { submissions, total }
 */
export async function listSubmissions({ models }, params = {}) {
  const { MarketplaceSubmission, User } = models;
  const { status = 'pending', page = 1, limit = 20 } = params;

  const where = {};
  if (status && status !== 'all') {
    where.status = status;
  }

  const offset = (Math.max(1, page) - 1) * limit;
  const { rows, count } = await MarketplaceSubmission.findAndCountAll({
    where,
    include: User
      ? [{ model: User, as: 'submitter', attributes: ['id', 'name'] }]
      : [],
    order: [['created_at', 'ASC']],
    limit: Math.min(limit, 100),
    offset,
  });

  return {
    submissions: rows,
    total: count,
    page: Math.max(1, page),
    totalPages: Math.ceil(count / limit),
  };
}

/**
 * Get submission detail for review.
 *
 * @param {Object} deps - { models }
 * @param {string} id - Submission UUID
 * @returns {Object} Submission
 */
export async function getSubmissionDetail({ models }, id) {
  const { MarketplaceSubmission, MarketplaceListing, User } = models;

  const submission = await MarketplaceSubmission.findByPk(id, {
    include: [
      User
        ? { model: User, as: 'submitter', attributes: ['id', 'name'] }
        : null,
      User ? { model: User, as: 'reviewer', attributes: ['id', 'name'] } : null,
      MarketplaceListing
        ? {
            model: MarketplaceListing,
            as: 'listing',
            attributes: ['id', 'name', 'key', 'version'],
          }
        : null,
    ].filter(Boolean),
  });

  if (!submission) {
    const err = new Error('Submission not found');
    err.status = 404;
    throw err;
  }

  return submission;
}

/**
 * Approve a submission — create or update the listing.
 *
 * @param {Object} deps - { models, fsEngine }
 * @param {string} submissionId - Submission UUID
 * @param {string} reviewerId - Admin user UUID
 * @param {string} [notes] - Optional approval notes
 * @returns {Object} { submission, listing }
 */
export async function approveSubmission(
  { models, fsEngine },
  submissionId,
  reviewerId,
  notes,
) {
  const { MarketplaceSubmission, MarketplaceListing } = models;

  const submission = await MarketplaceSubmission.findByPk(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.status = 404;
    throw err;
  }

  if (submission.status !== 'pending') {
    const err = new Error('Submission is not pending');
    err.status = 400;
    throw err;
  }

  // Move package from submissions to published storage
  const publishedPath = await fsEngine.move(submission.package_path, {
    directory: 'marketplace/packages',
    filename: `${submission.key}-${submission.version}.zip`,
  });

  // Create or update listing
  let listing;
  if (submission.listing_id) {
    listing = await MarketplaceListing.findByPk(submission.listing_id);
    if (listing) {
      await listing.update({
        name: submission.name,
        description: submission.description,
        short_description: submission.short_description,
        category: submission.category,
        tags: submission.tags,
        version: submission.version,
        package_path: publishedPath,
        published_at: new Date(),
        status: 'published',
      });
    }
  }

  if (!listing) {
    listing = await MarketplaceListing.create({
      name: submission.name,
      key: submission.key,
      description: submission.description,
      short_description: submission.short_description,
      category: submission.category,
      tags: submission.tags,
      version: submission.version,
      package_path: publishedPath,
      author: submission.name,
      author_id: submission.submitter_id,
      type: 'plugin',
      status: 'published',
      published_at: new Date(),
    });
  }

  // Update submission status
  await submission.update({
    listing_id: listing.id,
    status: 'approved',
    reviewed_by: reviewerId,
    reviewed_at: new Date(),
    review_notes: notes || null,
  });

  return { submission, listing };
}

/**
 * Reject a submission with review notes.
 *
 * @param {Object} deps - { models }
 * @param {string} submissionId - Submission UUID
 * @param {string} reviewerId - Admin user UUID
 * @param {string} notes - Rejection reason (required)
 * @returns {Object} Updated submission
 */
export async function rejectSubmission(
  { models },
  submissionId,
  reviewerId,
  notes,
) {
  const { MarketplaceSubmission } = models;

  const submission = await MarketplaceSubmission.findByPk(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.status = 404;
    throw err;
  }

  if (submission.status !== 'pending') {
    const err = new Error('Submission is not pending');
    err.status = 400;
    throw err;
  }

  await submission.update({
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date(),
    review_notes: notes,
  });

  return submission;
}

/**
 * Remove a listing (admin action).
 *
 * @param {Object} deps - { models }
 * @param {string} listingId - Listing UUID
 * @returns {boolean}
 */
export async function removeListing({ models }, listingId) {
  const { MarketplaceListing } = models;
  const listing = await MarketplaceListing.findByPk(listingId);
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  await listing.destroy();
  return true;
}

/**
 * Update listing metadata (admin action).
 *
 * @param {Object} deps - { models }
 * @param {string} listingId - Listing UUID
 * @param {Object} data - Updatable fields
 * @returns {Object} Updated listing
 */
export async function updateListing({ models }, listingId, data) {
  const { MarketplaceListing } = models;
  const listing = await MarketplaceListing.findByPk(listingId);
  if (!listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const allowedFields = [
    'name',
    'description',
    'short_description',
    'category',
    'tags',
    'icon',
    'screenshots',
    'compatibility',
    'status',
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  }

  await listing.update(updates);
  return listing;
}
