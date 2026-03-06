/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// FILE SERVICE - Core Business Logic for Drive
// ========================================================================

/**
 * Helper: Find file and verify ownership/access
 */
async function findAccessibleFile(
  fileId,
  userId,
  models,
  requiredAccess = 'owner',
) {
  const { File, FileShare } = models;

  const file = await File.findByPk(fileId, {
    paranoid: false, // In case we need to find trashed files
    include: [{ model: FileShare, as: 'shares' }],
  });

  if (!file) {
    throw new Error('File not found');
  }

  if (requiredAccess === 'owner' && file.owner_id !== userId) {
    throw new Error('Permission denied. Must be owner.');
  }

  // TODO: Implement more complex permission checks (viewer, editor) if needed
  return file;
}

/**
 * List files and folders for a user
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {string} options.view - 'my_drive', 'recent', 'starred', 'trash', 'shared_with_me'
 * @param {string|null} [options.parentId] - Folder ID (only applies to my_drive view)
 * @param {Object} context - App context { models }
 */
export async function listFiles(
  userId,
  {
    view = 'my_drive',
    parentId = null,
    search = '',
    page = 1,
    pageSize = 50,
  } = {},
  { models },
) {
  const { File } = models;
  const { sequelize } = File;
  const { Op } = sequelize.Sequelize;

  const where = {
    owner_id: userId,
  };

  const queryOptions = {
    where,
    order: [
      ['type', 'DESC'], // Folders first
      ['name', 'ASC'],
    ],
    paranoid: true, // Only show non-deleted by default
  };

  // Pagination logic
  if (page && pageSize) {
    queryOptions.limit = parseInt(pageSize, 10);
    queryOptions.offset = (parseInt(page, 10) - 1) * queryOptions.limit;
  }

  // Search logic
  if (search) {
    where.name = { [Op.like]: `%${search}%` };
    // If searching, we often want to search globally or within the view
    // but ignoring parentId if search is provided is a common pattern for "search all"
    // However, if the user is in "Trash", they expect to search within trash.
  }

  switch (view) {
    case 'my_drive':
      if (!search) {
        where.parent_id = parentId; // null = root
      }
      break;
    case 'recent':
      where.type = 'file';
      queryOptions.order = [['updated_at', 'DESC']];
      if (!pageSize) queryOptions.limit = 50;
      break;
    case 'starred':
      where.is_starred = true;
      break;
    case 'trash':
      queryOptions.paranoid = false;
      where.deleted_at = { [Op.not]: null };
      break;
    default:
      throw new Error(`Invalid view type: ${view}`);
  }

  const { rows: files, count: total } =
    await File.findAndCountAll(queryOptions);

  // If viewing a specific folder, also return the folder details and breadcrumbs
  let currentFolder = null;
  let breadcrumbs = [];

  if (parentId && view === 'my_drive') {
    currentFolder = await File.findByPk(parentId);
    breadcrumbs = await getBreadcrumbs(parentId, { models });
  } else if (view !== 'my_drive') {
    breadcrumbs = [
      { id: view, name: view.charAt(0).toUpperCase() + view.slice(1) },
    ];
  } else {
    breadcrumbs = [{ id: 'root', name: 'My Drive' }];
  }

  return { files, currentFolder, breadcrumbs, total };
}

/**
 * Get folder breadcrumbs hierarchy
 */
export async function getBreadcrumbs(folderId, { models }) {
  const { File } = models;
  let currentId = folderId;
  const breadcrumbs = [];

  while (currentId) {
    const folder = await File.findByPk(currentId, {
      attributes: ['id', 'name', 'parent_id'],
    });
    if (!folder) break;

    breadcrumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }

  breadcrumbs.unshift({ id: 'root', name: 'My Drive' });
  return breadcrumbs;
}

/**
 * Create a new virtual folder
 */
export async function createFolder(userId, name, parentId = null, { models }) {
  const { File } = models;

  if (parentId) {
    await findAccessibleFile(parentId, userId, models, 'owner'); // Ensure parent exists and user owns it
  }

  return File.create({
    owner_id: userId,
    name,
    parent_id: parentId,
    type: 'folder',
  });
}

/**
 * Handle new file upload record
 */
export async function uploadFile(
  userId,
  fileMetadata,
  parentId = null,
  { models },
) {
  const { File } = models;

  if (parentId) {
    await findAccessibleFile(parentId, userId, models, 'owner');
  }

  return File.create({
    owner_id: userId,
    name: fileMetadata.name,
    parent_id: parentId,
    type: 'file',
    mime_type: fileMetadata.mime_type,
    size: fileMetadata.size,
    path: fileMetadata.path,
  });
}

/**
 * Rename a file or folder
 */
export async function renameFile(userId, fileId, newName, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');
  file.name = newName;
  return file.save();
}

/**
 * Move a file or folder
 */
export async function moveFile(userId, fileId, newParentId, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');

  if (newParentId) {
    // Prevent moving a folder into itself or its children
    if (file.id === newParentId) {
      throw new Error('Cannot move a folder into itself');
    }
    await findAccessibleFile(newParentId, userId, models, 'owner');
    // TODO: Add complex cyclic check if moving folders
  }

  file.parent_id = newParentId;
  return file.save();
}

/**
 * Toggle starred status
 */
export async function toggleStar(userId, fileId, isStarred, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');
  file.is_starred = isStarred;
  return file.save();
}

/**
 * Soft delete (move to Trash)
 */
export async function trashFile(userId, fileId, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');
  // Sequelize paranoid mode handles deleted_at mapping via destroy()
  await file.destroy();
  return file;
}

/**
 * Restore from Trash
 */
export async function restoreFile(userId, fileId, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');
  if (!file.deleted_at) {
    throw new Error('File is not in trash');
  }
  await file.restore();
  return file;
}

/**
 * Permanently delete a file (and from disk)
 */
export async function deleteFilePermanently(userId, fileId, { models, fs }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');

  if (file.type === 'file' && file.path && fs) {
    try {
      await fs.remove(file.path);
    } catch (error) {
      console.error(`Failed to delete physical file: ${file.path}`, error);
    }
  } else if (file.type === 'folder') {
    // Determine all children recursively and delete them
    const { File } = models;
    const children = await File.findAll({
      where: { parent_id: file.id },
      paranoid: false,
    });
    for (const child of children) {
      await deleteFilePermanently(userId, child.id, { models, fs });
    }
  }

  // Force delete from DB
  await file.destroy({ force: true });
  return true;
}

/**
 * Empty Trash
 */
export async function emptyTrash(userId, { models, fs }) {
  const { File } = models;
  const { sequelize } = File;
  const { Op } = sequelize.Sequelize;
  const trashedFiles = await File.findAll({
    where: {
      owner_id: userId,
      deleted_at: { [Op.not]: null },
    },
    paranoid: false,
  });

  for (const file of trashedFiles) {
    // If it's a root trashed item, we delete it completely
    // We don't need to recursively call IF the structure in DB allows cascading,
    // but we do need to remove physical files.
    if (file.type === 'file' && file.path && fs) {
      try {
        await fs.remove(file.path);
      } catch (error) {
        console.error(`Failed to delete physical file: ${file.path}`, error);
      }
    }
  }

  // Force delete all trashed
  await File.destroy({
    where: {
      owner_id: userId,
      deleted_at: { [Op.not]: null },
    },
    force: true,
  });

  return true;
}

/**
 * Update Sharing Settings
 */
export async function updateSharing(userId, fileId, shareType, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'owner');
  const validTypes = ['private', 'public_link', 'shared_users'];

  if (!validTypes.includes(shareType)) {
    throw new Error('Invalid share type');
  }

  file.share_type = shareType;
  return file.save();
}

/**
 * Download or Preview a file
 */
export async function getPhysicalFileStream(userId, fileId, { models, fs }) {
  // Try to find file without ownership strict test first to allow shared files
  const { File } = models;
  const file = await File.findByPk(fileId);

  if (!file) throw new Error('File not found');

  // Basic permission check
  if (file.owner_id !== userId && file.share_type === 'private') {
    throw new Error('Permission denied');
  }

  if (file.type !== 'file' || !file.path) {
    throw new Error('Requested item is not a downloadable file');
  }

  // Use the fs service to stream
  const result = await fs.preview(file.path);
  if (!result.success) {
    throw new Error('File data not found on server');
  }

  return {
    stream: result.data.stream,
    headers: result.data.headers,
    filename: file.name,
    mimeType: file.mime_type,
    size: file.size,
  };
}
