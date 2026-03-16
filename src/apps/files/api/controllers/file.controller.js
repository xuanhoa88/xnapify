/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { validateForm } from '@shared/validator';

import {
  createFolderFormSchema,
  renameFileFormSchema,
  shareFileFormSchema,
} from '../../validator/admin/file';
import * as fileService from '../services/file.service';

// ========================================================================
// FILE CONTROLLERS
// ========================================================================

/**
 * List files and folders
 *
 * @route   GET /api/files
 */
export async function getFiles(req, res) {
  const http = req.app.get('http');
  try {
    const { view, parentId, search, page, pageSize } = req.query;

    const result = await fileService.listFiles(
      req.user.id,
      {
        view: view || 'my_drive',
        parentId: parentId || null,
        search: search || '',
        page: page || 1,
        pageSize: pageSize || 50,
      },
      { models: req.app.get('models') },
    );

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch files', error);
  }
}

/**
 * Create a new folder
 *
 * @route   POST /api/files/folder
 */
export async function createFolder(req, res) {
  const http = req.app.get('http');
  try {
    const [isValid, errors] = validateForm(createFolderFormSchema, req.body);

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const { name, parentId } = errors;

    const folder = await fileService.createFolder(req.user.id, name, parentId, {
      models: req.app.get('models'),
    });

    return http.sendSuccess(res, { folder });
  } catch (error) {
    return http.sendServerError(res, 'Failed to create folder', error);
  }
}

/**
 * Upload file
 *
 * @route   POST /api/files/upload
 */
export async function uploadFile(req, res) {
  const http = req.app.get('http');
  const fs = req.app.get('fs');

  try {
    // Check upload result from middleware
    const uploadResult = req[fs.MIDDLEWARES.UPLOAD];
    if (!uploadResult || !uploadResult.success) {
      const errorMsg =
        (uploadResult && uploadResult.error) || 'No file uploaded';
      return http.sendValidationError(res, { file: errorMsg });
    }

    // `fs` middleware places info in req.file (if multer) or uploadResult depending on how rapid-rsk is built
    // Usually it provides a relative path or filename
    const fileMetadata = {
      name:
        uploadResult.data.originalName ||
        (req.file && req.file.originalname) ||
        uploadResult.data.fileName,
      mime_type: uploadResult.data.mimeType || (req.file && req.file.mimetype),
      size: uploadResult.data.size || (req.file && req.file.size) || 0,
      path: uploadResult.data.fileName || (req.file && req.file.filename), // The actual saved filename relative to uploads
    };

    const { parentId } = req.body || req.query;

    const file = await fileService.uploadFile(
      req.user.id,
      fileMetadata,
      parentId,
      {
        models: req.app.get('models'),
      },
    );

    return http.sendSuccess(res, { file });
  } catch (error) {
    return http.sendServerError(res, 'Failed to upload file', error);
  }
}

/**
 * Rename file or folder
 *
 * @route   PUT /api/files/:id/rename
 */
export async function renameFile(req, res) {
  const http = req.app.get('http');
  try {
    const [isValid, errors] = validateForm(renameFileFormSchema, req.body);

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const { name } = errors;

    const file = await fileService.renameFile(
      req.user.id,
      req.params.id,
      name,
      {
        models: req.app.get('models'),
      },
    );

    return http.sendSuccess(res, { file });
  } catch (error) {
    return http.sendServerError(res, 'Failed to rename file', error);
  }
}

/**
 * Move file or folder
 *
 * @route   PUT /api/files/:id/move
 */
export async function moveFile(req, res) {
  const http = req.app.get('http');
  try {
    const { parentId } = req.body;

    const file = await fileService.moveFile(
      req.user.id,
      req.params.id,
      parentId,
      {
        models: req.app.get('models'),
      },
    );

    return http.sendSuccess(res, { file });
  } catch (error) {
    return http.sendServerError(res, 'Failed to move file', error);
  }
}

/**
 * Toggle starred
 *
 * @route   PUT /api/files/:id/star
 */
export async function toggleStar(req, res) {
  const http = req.app.get('http');
  try {
    const { isStarred } = req.body;

    const file = await fileService.toggleStar(
      req.user.id,
      req.params.id,
      isStarred,
      {
        models: req.app.get('models'),
      },
    );

    return http.sendSuccess(res, { file });
  } catch (error) {
    return http.sendServerError(res, 'Failed to update star', error);
  }
}

/**
 * Move to trash (Soft delete)
 *
 * @route   DELETE /api/files/:id
 */
export async function trashFile(req, res) {
  const http = req.app.get('http');
  try {
    await fileService.trashFile(req.user.id, req.params.id, {
      models: req.app.get('models'),
    });

    return http.sendSuccess(res, { message: 'Item moved to trash' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to move to trash', error);
  }
}

/**
 * Restore from trash
 *
 * @route   POST /api/files/:id/restore
 */
export async function restoreFile(req, res) {
  const http = req.app.get('http');
  try {
    const file = await fileService.restoreFile(req.user.id, req.params.id, {
      models: req.app.get('models'),
    });

    return http.sendSuccess(res, { file, message: 'Item restored' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to restore item', error);
  }
}

/**
 * Permanently delete
 *
 * @route   DELETE /api/files/:id/permanent
 */
export async function deletePermanent(req, res) {
  const http = req.app.get('http');
  try {
    await fileService.deleteFilePermanently(req.user.id, req.params.id, {
      models: req.app.get('models'),
      fs: req.app.get('fs'),
    });

    return http.sendSuccess(res, { message: 'Item permanently deleted' });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to permanently delete item',
      error,
    );
  }
}

/**
 * Empty Trash
 *
 * @route   DELETE /api/files/trash/empty
 */
export async function emptyTrash(req, res) {
  const http = req.app.get('http');
  try {
    await fileService.emptyTrash(req.user.id, {
      models: req.app.get('models'),
      fs: req.app.get('fs'),
    });

    return http.sendSuccess(res, { message: 'Trash emptied' });
  } catch (error) {
    return http.sendServerError(res, 'Failed to empty trash', error);
  }
}

/**
 * Update Sharing Settings
 *
 * @route   PUT /api/files/:id/share
 */
export async function updateSharing(req, res) {
  const http = req.app.get('http');
  try {
    const [isValid, errors] = validateForm(shareFileFormSchema, req.body);

    if (!isValid) {
      return http.sendValidationError(res, errors);
    }

    const { shareType, shares } = errors;

    const file = await fileService.updateSharing(
      req.user.id,
      req.params.id,
      { shareType, shares },
      {
        models: req.app.get('models'),
        hook: req.app.get('hook'),
      },
    );

    return http.sendSuccess(res, { file, message: 'Sharing settings updated' });
  } catch (error) {
    return http.sendServerError(
      res,
      'Failed to update sharing settings',
      error,
    );
  }
}

/**
 * Get current sharing status
 *
 * @route   GET /api/files/:id/shares
 */
export async function getFileShares(req, res) {
  const http = req.app.get('http');
  try {
    const shares = await fileService.getFileShares(req.user.id, req.params.id, {
      models: req.app.get('models'),
    });

    return http.sendSuccess(res, shares);
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch sharing settings', error);
  }
}

/**
 * Download or Preview physical file
 *
 * @route   GET /api/files/:id/download
 */
export async function downloadFile(req, res) {
  const http = req.app.get('http');

  try {
    const isDownload = req.query.download === 'true';

    const result = await fileService.getPhysicalFileStream(
      req.user && req.user.id ? req.user.id : null,
      req.params.id,
      {
        models: req.app.get('models'),
        fs: req.app.get('fs'),
        download: isDownload,
      },
    );

    // Set headers from the FS result (it provides Content-Type, Content-Length, Content-Disposition, etc.)
    Object.entries(result.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Special case: we still want to ensure the filename from our DB is used if FS provider doesn't know it
    // though fs.download/preview usually set it correctly if metadata was available.
    // If we want to override it with the DB filename:
    if (isDownload) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.filename)}"`,
      );
    }

    result.stream.pipe(res);
  } catch (error) {
    return http.sendServerError(res, 'Failed to download file', error);
  }
}

/**
 * Get storage usage
 *
 * @route   GET /api/files/storage
 */
export async function getStorage(req, res) {
  const http = req.app.get('http');
  try {
    const result = await fileService.getStorageUsage(req.user.id, {
      models: req.app.get('models'),
    });

    return http.sendSuccess(res, result);
  } catch (error) {
    return http.sendServerError(res, 'Failed to fetch storage usage', error);
  }
}
