/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Download Controller
 *
 * Handles file download operations with support for single files and ZIP archives.
 */

import path from 'path';
import * as filesystemActions from '../actions';
import workerService from '../workers';
import { generateSecureFileName, MIDDLEWARE_RESULT } from '../utils';

/**
 * Handle file download with automatic ZIP creation for multiple files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Controller options
 * @param {boolean} options.asMiddleware - If true, store result in req[DOWNLOAD] and call next()
 * @param {Function} next - Express next middleware function
 */
export async function downloadFiles(req, res, options = {}, next = null) {
  const config = {
    asMiddleware: false,
    ...options,
  };

  try {
    const { files, fileName, zipName, compressionLevel } = req.query;
    let fileNames;

    // Parse file names from different parameter formats
    if (fileName) {
      if (fileName.includes(',')) {
        fileNames = fileName.split(',').map(f => f.trim());
      } else {
        fileNames = [fileName];
      }
    } else if (files) {
      let parsedFiles;
      try {
        parsedFiles = typeof files === 'string' ? JSON.parse(files) : files;
      } catch (e) {
        parsedFiles =
          typeof files === 'string'
            ? files.split(',').map(f => f.trim())
            : files;
      }
      fileNames = Array.isArray(parsedFiles) ? parsedFiles : [parsedFiles];
    } else {
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.DOWNLOAD] = {
          success: false,
          error: 'Either fileName or files parameter is required',
        };
        return next();
      }
      return res.status(400).json({
        success: false,
        error: 'Either fileName or files parameter is required',
      });
    }

    // Route based on file count: single file vs multiple files
    if (fileNames.length === 1) {
      // Single file - use downloadFile for direct streaming
      try {
        const downloadResult = await filesystemActions.downloadFile(
          fileNames[0],
        );

        if (!downloadResult.success) {
          if (config.asMiddleware && next) {
            req[MIDDLEWARE_RESULT.DOWNLOAD] = {
              success: false,
              error: 'File not found',
              fileName: fileNames[0],
            };
            return next();
          }
          return res.status(404).json({
            success: false,
            error: 'File not found',
            fileName: fileNames[0],
          });
        }

        // Middleware mode: store result and call next (without streaming)
        if (config.asMiddleware && next) {
          req[MIDDLEWARE_RESULT.DOWNLOAD] = downloadResult;
          return next();
        }

        // Set headers for file download
        Object.entries(downloadResult.data.headers).forEach(([key, value]) =>
          res.set(key, value),
        );

        // Stream the file
        const stream =
          downloadResult.data.stream.stream || downloadResult.data.stream;
        stream.pipe(res);
      } catch (error) {
        if (config.asMiddleware && next) {
          req[MIDDLEWARE_RESULT.DOWNLOAD] = {
            success: false,
            error: 'Download failed',
            details: error.message,
          };
          return next();
        }
        return res.status(500).json({
          success: false,
          error: 'Download failed',
          details: error.message,
        });
      }
    } else {
      const downloadOptions = {
        zipName: zipName
          ? `${path.basename(zipName)}.zip`
          : generateSecureFileName(`${fileNames.join('|')}.zip`),
        compressionLevel: compressionLevel ? parseInt(compressionLevel, 10) : 6,
      };

      // Use worker service for multiple files
      const result = await workerService.processDownload(
        fileNames,
        downloadOptions,
      );

      // Handle worker response structure (workers return { id, success, result })
      const actualResult = result.result || result;

      if (!actualResult.success) {
        if (config.asMiddleware && next) {
          req[MIDDLEWARE_RESULT.DOWNLOAD] = actualResult;
          return next();
        }
        return res
          .status((actualResult.error && actualResult.error.statusCode) || 500)
          .json(actualResult);
      }

      // Middleware mode: store result and call next
      if (config.asMiddleware && next) {
        req[MIDDLEWARE_RESULT.DOWNLOAD] = actualResult;
        return next();
      }

      // downloadFiles always returns ZIP, so send it
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${downloadOptions.zipName}"`,
      });
      res.send(actualResult.data.buffer);
    }
  } catch (error) {
    console.error('Download error:', error);
    if (config.asMiddleware && next) {
      req.downloadResult = {
        success: false,
        error: 'Download failed',
        details: error.message,
      };
      return next();
    }
    return res.status(500).json({
      success: false,
      error: 'Download failed',
      details: error.message,
    });
  }
}
