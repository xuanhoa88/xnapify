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
  requiredAccess = 'viewer',
) {
  const { File, FileShare, UserGroup } = models;

  // 1. Get user groups for group-based sharing
  const userGroups = await UserGroup.findAll({
    where: { user_id: userId },
    attributes: ['group_id'],
  });
  const groupIds = userGroups.map(ug => ug.group_id);

  // 2. Helper to check if a single file has access
  const checkDirectAccess = async id => {
    const f = await File.findByPk(id, {
      paranoid: false,
      include: [{ model: FileShare, as: 'shares' }],
    });
    if (!f) return null;

    if (f.owner_id === userId) return { file: f, permission: 'editor' };
    if (f.share_type === 'public_link')
      return { file: f, permission: 'viewer' };

    let best = null;
    for (const s of f.shares) {
      if (
        s.user_id === userId ||
        (s.group_id && groupIds.includes(s.group_id))
      ) {
        if (s.permission === 'editor') return { file: f, permission: 'editor' };
        best = 'viewer';
      }
    }
    return best ? { file: f, permission: best } : null;
  };

  // 3. Check target file first
  let target = await File.findByPk(fileId, { paranoid: false });
  if (!target) {
    const err = new Error('File not found');
    err.name = 'FileNotFoundError';
    err.status = 404;
    throw err;
  }

  let access = await checkDirectAccess(fileId);
  if (
    access &&
    (requiredAccess === 'viewer' || access.permission === 'editor')
  ) {
    return access.file;
  }

  // 4. Traverse up for inheritance
  let currentId = target.parent_id;
  while (currentId) {
    access = await checkDirectAccess(currentId);
    if (access) {
      // If we found access in a parent, it applies to children
      if (requiredAccess === 'viewer' || access.permission === 'editor') {
        return target;
      }
      break; // Found some access but not enough?
    }
    const parent = await File.findByPk(currentId, {
      attributes: ['parent_id'],
    });
    currentId = parent ? parent.parent_id : null;
  }

  const err = new Error(`Permission denied. Required: ${requiredAccess}`);
  err.name = 'PermissionDeniedError';
  err.status = 403;
  throw err;
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
  const { File, FileShare, UserGroup } = models;
  const { sequelize } = File;
  const { Op } = sequelize.Sequelize;

  const where = {};
  const queryOptions = {
    where,
    order: [
      ['type', 'DESC'],
      ['name', 'ASC'],
    ],
    paranoid: true,
  };

  // Pagination logic
  if (page && pageSize) {
    queryOptions.limit = parseInt(pageSize, 10);
    queryOptions.offset = (parseInt(page, 10) - 1) * queryOptions.limit;
  }

  // Search logic
  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  switch (view) {
    case 'my_drive':
      if (parentId) {
        // If navigating into a folder, ensure access exists
        // (This will also handle shared folders due to inheritance in findAccessibleFile)
        await findAccessibleFile(parentId, userId, models, 'viewer');
        where.parent_id = parentId;
      } else {
        where.owner_id = userId;
        if (!search) {
          where.parent_id = null; // null = root of My Drive
        }
      }
      break;
    case 'shared_with_me': {
      const userGroups = await UserGroup.findAll({
        where: { user_id: userId },
        attributes: ['group_id'],
      });
      const groupIds = userGroups.map(ug => ug.group_id);

      const sharedFiles = await FileShare.findAll({
        where: {
          [Op.or]: [{ user_id: userId }, { group_id: { [Op.in]: groupIds } }],
        },
        attributes: ['file_id'],
      });
      const sharedIds = [...new Set(sharedFiles.map(s => s.file_id))];

      where.id = { [Op.in]: sharedIds };
      where.owner_id = { [Op.ne]: userId }; // Don't show owned files in shared
      break;
    }
    case 'recent':
      where.owner_id = userId;
      where.type = 'file';
      queryOptions.order = [['updated_at', 'DESC']];
      if (!pageSize) queryOptions.limit = 50;
      break;
    case 'starred':
      where.owner_id = userId;
      where.is_starred = true;
      break;
    case 'trash':
      where.owner_id = userId;
      queryOptions.paranoid = false;
      where.deleted_at = { [Op.not]: null };
      break;
    default: {
      const err = new Error(`Invalid view type: ${view}`);
      err.name = 'InvalidViewTypeError';
      err.status = 400;
      throw err;
    }
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
  const file = await findAccessibleFile(fileId, userId, models, 'editor');
  file.name = newName;
  return file.save();
}

/**
 * Move a file or folder
 */
export async function moveFile(userId, fileId, newParentId, { models }) {
  const file = await findAccessibleFile(fileId, userId, models, 'editor');

  if (newParentId) {
    // Prevent moving a folder into itself or its children
    if (file.id === newParentId) {
      const err = new Error('Cannot move a folder into itself');
      err.name = 'CannotMoveFolderError';
      err.status = 400;
      throw err;
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
  const file = await findAccessibleFile(fileId, userId, models, 'viewer');
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
    const err = new Error('File is not in trash');
    err.name = 'FileNotInTrashError';
    err.status = 400;
    throw err;
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
export async function updateSharing(
  userId,
  fileId,
  { shareType, shares = [] },
  { models },
) {
  const { File, FileShare, User, Group } = models;
  const file = await findAccessibleFile(fileId, userId, models, 'owner');

  const validTypes = ['private', 'public_link', 'shared_users'];
  if (!validTypes.includes(shareType)) {
    const err = new Error('Invalid share type');
    err.name = 'InvalidShareTypeError';
    err.status = 400;
    throw err;
  }

  const { sequelize } = File;
  return sequelize.transaction(async t => {
    file.share_type = shareType;
    await file.save({ transaction: t });

    // Sync shares
    // 1. Delete old shares
    await FileShare.destroy({
      where: { file_id: fileId },
      transaction: t,
    });

    // 2. Add new ones if share_type is search-based
    if (shareType === 'shared_users' && shares.length > 0) {
      const shareRecords = shares.map(s => ({
        file_id: fileId,
        user_id: s.userId || null,
        group_id: s.groupId || null,
        permission: s.permission || 'viewer',
      }));

      await FileShare.bulkCreate(shareRecords, { transaction: t });
    }

    // Return the updated file with shares included
    return File.findByPk(fileId, {
      include: [
        {
          model: FileShare,
          as: 'shares',
          include: [
            { model: User, as: 'user', attributes: ['id', 'email'] },
            { model: Group, as: 'group', attributes: ['id', 'name'] },
          ],
        },
      ],
      transaction: t,
    });
  });
}

/**
 * Get current sharing status
 */
export async function getFileShares(userId, fileId, { models }) {
  const { File, FileShare, User, Group } = models;

  // Must be owner or have at least editor access to see who it's shared with
  await findAccessibleFile(fileId, userId, models, 'editor');

  return File.findByPk(fileId, {
    attributes: ['id', 'name', 'share_type'],
    include: [
      {
        model: FileShare,
        as: 'shares',
        include: [
          { model: User, as: 'user', attributes: ['id', 'email'] },
          { model: Group, as: 'group', attributes: ['id', 'name'] },
        ],
      },
    ],
  });
}

/**
 * Download or Preview a file
 */
export async function getPhysicalFileStream(
  userId,
  fileId,
  { models, fs, download = false },
) {
  // Centralized permission check. If user is downloading, they need 'editor' access (Edit/Download)
  // If they are just previewing, 'viewer' access is sufficient.
  const requiredAccess = download ? 'editor' : 'viewer';
  const file = await findAccessibleFile(fileId, userId, models, requiredAccess);

  if (file.type !== 'file' || !file.path) {
    const err = new Error('Requested item is not a downloadable file');
    err.name = 'NotADownloadFileError';
    err.status = 400;
    throw err;
  }

  // Use the fs service to stream
  // If download is requested, use the dedicated download service
  // which might trigger worker processing or zip creation for batches (not here but consistent)
  // and provides standard attachment headers.
  const result = await (download
    ? fs.download(file.path)
    : fs.preview(file.path));

  if (!result.success) {
    const err = new Error('File data not found on server');
    err.name = 'FileNotFoundError';
    err.status = 404;
    throw err;
  }

  return {
    stream: result.data.stream,
    headers: result.data.headers,
    filename: file.name,
    mimeType: file.mime_type,
    size: file.size,
  };
}

/**
 * Get total storage usage for a user
 */
export async function getStorageUsage(userId, { models }) {
  const { File } = models;
  const totalSize = await File.sum('size', {
    where: {
      owner_id: userId,
      type: 'file',
    },
  });

  return {
    used: parseInt(totalSize || 0, 10),
    total: 100 * 1024 * 1024 * 1024, // 100 GB (hardcoded for now)
  };
}
