/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as fileController from '../../../controllers/file.controller';

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const post = [
  requirePermission('files:create'),
  (req, res, next) => {
    const fs = req.app.get('container').resolve('fs');
    return fs.useUploadMiddleware({
      fieldName: 'file',
      maxSize: 50 * 1024 * 1024,
    })(req, res, next);
  },
  fileController.uploadFile,
];
