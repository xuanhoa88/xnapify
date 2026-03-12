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
 * Permission hierarchy: owner > editor > viewer
 * Returns true if `actual` permission is sufficient for `required` permission.
 */
const PERMISSION_LEVELS = { viewer: 1, editor: 2, owner: 3 };

function hasEnoughPermission(actual, required) {
  return (PERMISSION_LEVELS[actual] || 0) >= (PERMISSION_LEVELS[required] || 0);
}

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

  // 1. Get user groups for group-based sharing (only if logged in)
  let groupIds = [];
  if (userId) {
    const userGroups = await UserGroup.findAll({
      where: { user_id: userId },
      attributes: ['group_id'],
    });
    groupIds = userGroups.map(ug => ug.group_id);
  }

  // 2. Helper to check if a single file has access
  const checkDirectAccess = async id => {
    const include = [{ model: FileShare, as: 'shares' }];
    if (userId && models.FileStar) {
      include.push({
        model: models.FileStar,
        as: 'stars',
        required: false,
        where: { user_id: userId },
        attributes: ['id'],
      });
    }

    const f = await File.findByPk(id, {
      paranoid: false,
      include,
    });

    if (!f) return null;

    // Inject personal star status natively
    f.dataValues.is_starred = Array.isArray(f.stars) && f.stars.length > 0;

    if (userId && f.owner_id === userId) {
      return { file: f, permission: 'owner' };
    }
    if (f.share_type === 'public_link') {
      return { file: f, permission: 'viewer' };
    }

    let best = null;
    if (userId) {
      for (const s of f.shares) {
        if (
          (s.entity_type === 'user' && s.entity_id === userId) ||
          (s.entity_type === 'group' && groupIds.includes(s.entity_id))
        ) {
          if (s.permission === 'editor') {
            return { file: f, permission: 'editor' };
          }
          best = 'viewer';
        }
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
  if (access && hasEnoughPermission(access.permission, requiredAccess)) {
    return access.file;
  }

  // 4. Traverse up for inheritance
  let currentId = target.parent_id;
  while (currentId) {
    access = await checkDirectAccess(currentId);
    if (access) {
      // If we found access in a parent, it applies to children
      if (hasEnoughPermission(access.permission, requiredAccess)) {
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
  const { File, FileShare, UserGroup, FileStar } = models;
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
    include: [
      {
        model: FileStar,
        as: 'stars',
        required: view === 'starred',
        where: { user_id: userId },
        attributes: ['id'],
      },
    ],
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
      if (parentId) {
        // If navigating into a folder that has been shared with the user
        await findAccessibleFile(parentId, userId, models, 'viewer');
        where.parent_id = parentId;
      } else {
        const userGroups = await UserGroup.findAll({
          where: { user_id: userId },
          attributes: ['group_id'],
        });
        const groupIds = userGroups.map(ug => ug.group_id);

        const entityConditions = [{ entity_type: 'user', entity_id: userId }];
        if (groupIds.length > 0) {
          entityConditions.push({
            entity_type: 'group',
            entity_id: { [Op.in]: groupIds },
          });
        }

        const sharedFiles = await FileShare.findAll({
          where: { [Op.or]: entityConditions },
          attributes: ['file_id'],
        });
        const sharedIds = [...new Set(sharedFiles.map(s => s.file_id))];

        where.id = { [Op.in]: sharedIds };
        where.owner_id = { [Op.ne]: userId }; // Don't show owned files in shared root
      }
      break;
    }
    case 'recent':
      where.owner_id = userId;
      where.type = 'file';
      queryOptions.order = [['updated_at', 'DESC']];
      if (!pageSize) queryOptions.limit = 50;
      break;
    case 'starred': {
      const userGroups = await UserGroup.findAll({
        where: { user_id: userId },
        attributes: ['group_id'],
      });
      const groupIds = userGroups.map(ug => ug.group_id);

      const entityConditions = [{ entity_type: 'user', entity_id: userId }];
      if (groupIds.length > 0) {
        entityConditions.push({
          entity_type: 'group',
          entity_id: { [Op.in]: groupIds },
        });
      }

      const sharedFiles = await FileShare.findAll({
        where: { [Op.or]: entityConditions },
        attributes: ['file_id'],
      });
      const sharedIds = [...new Set(sharedFiles.map(s => s.file_id))];

      where[Op.or] = [{ owner_id: userId }, { id: { [Op.in]: sharedIds } }];
      break;
    }
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

  if (parentId) {
    currentFolder = await File.findByPk(parentId);
    breadcrumbs = await getBreadcrumbs(parentId, { models });

    // If not in standard 'my_drive', prepend the root virtual category string so users can jump back
    if (view !== 'my_drive') {
      const formattedViewName = view
        .split('_')
        .map((word, i) =>
          i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
        )
        .join(' ');

      // Remove 'root = My Drive' and prepend 'view = Shared with me'
      breadcrumbs[0] = { id: view, name: formattedViewName };
    }
  } else if (view !== 'my_drive') {
    const formattedViewName = view
      .split('_')
      .map((word, i) =>
        i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
      )
      .join(' ');
    breadcrumbs = [{ id: view, name: formattedViewName }];
  } else {
    breadcrumbs = [{ id: 'root', name: 'My Drive' }];
  }

  const processedFiles = files.map(file => {
    const f = file.toJSON();
    f.is_starred = Array.isArray(f.stars) && f.stars.length > 0;
    delete f.stars;
    return f;
  });

  return { files: processedFiles, currentFolder, breadcrumbs, total };
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
  const { FileStar } = models;
  const file = await findAccessibleFile(fileId, userId, models, 'viewer');

  if (isStarred) {
    await FileStar.findOrCreate({
      where: { user_id: userId, file_id: file.id },
    });
  } else {
    await FileStar.destroy({
      where: { user_id: userId, file_id: file.id },
    });
  }

  // Frontend expects file object with is_starred appended
  return {
    ...(file.toJSON ? file.toJSON() : file),
    is_starred: isStarred,
  };
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
  { models, emailManager },
) {
  const { File, FileShare, User, Group } = models;
  const file = await findAccessibleFile(fileId, userId, models, 'editor');

  const validTypes = ['private', 'public_link', 'shared_users'];
  if (!validTypes.includes(shareType)) {
    const err = new Error('Invalid share type');
    err.name = 'InvalidShareTypeError';
    err.status = 400;
    throw err;
  }

  const { sequelize } = File;

  // Determine which new users are getting access
  let newUsersToNotify = [];
  if (emailManager && shareType === 'shared_users' && shares.length > 0) {
    const existingShares = await FileShare.findAll({
      where: { file_id: fileId, entity_type: 'user' },
    });
    const existingUserIds = existingShares.map(s => s.entity_id);

    const newlyAddedUserIds = shares
      .filter(
        s => s.entityType === 'user' && !existingUserIds.includes(s.entityId),
      )
      .map(s => s.entityId);

    if (newlyAddedUserIds.length > 0) {
      newUsersToNotify = await User.findAll({
        where: { id: newlyAddedUserIds },
        attributes: ['id', 'email'],
      });
    }
  }

  const result = await sequelize.transaction(async t => {
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
        entity_id: s.entityId,
        entity_type: s.entityType,
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

  // Send notifications outside transaction
  if (newUsersToNotify.length > 0) {
    const sharer = await User.findByPk(userId);
    const sharerEmail = sharer ? sharer.email : 'A user';

    await Promise.all(
      newUsersToNotify.map(async u => {
        try {
          await emailManager.send(
            {
              to: u.email,
              subject: `New File Shared With You on ${process.env['RSK_APP_NAME']}`,
              html: `
                <p>Hi,</p>
                <p>${sharerEmail} has shared a file with you.</p>
                <p><a href="${process.env['RSK_APP_URL']}/drive">Open your Drive</a> to view it.</p>
              `,
            },
            { useWorker: true, maxRetries: 3 },
          );
        } catch (err) {
          console.error('Failed to send file share notification email:', err);
        }
      }),
    );
  }

  return result;
}

/**
 * Get current sharing status
 */
export async function getFileShares(userId, fileId, { models }) {
  const { File, FileShare, User, Group } = models;

  // Must be owner or have at least editor access to see who it's shared with
  await findAccessibleFile(fileId, userId, models, 'editor');

  return File.findByPk(fileId, {
    attributes: ['id', 'name', 'share_type', 'owner_id'],
    include: [
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'email'],
      },
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
  // Both downloading and previewing only require 'viewer' access.
  // (A public link grants 'viewer' access, so this allows guests to download).
  const requiredAccess = 'viewer';
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
