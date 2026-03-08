/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as fileController from '../../../../controllers/file.controller';

// PUT /api/files/:id/move
export const put = [
  (req, res, next) => {
    const { middlewares } = req.app.get('auth');
    return middlewares.requirePermission('files:update')(req, res, next);
  },
  fileController.moveFile,
];
