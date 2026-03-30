/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as hubSubmissionController from '../../../../controllers/hub.submission.controller';

export const useRateLimit = false;

function requirePermission(permission) {
  return (req, res, next) => {
    const {
      middlewares: { requirePermission },
    } = req.app.get('container').resolve('auth');
    return requirePermission(permission)(req, res, next);
  };
}

export const post = [
  requirePermission('marketplace:submit'),
  (req, res, next) =>
    req.app
      .get('container')
      .resolve('fs')
      .useUploadMiddleware({ fieldName: 'file' })(req, res, next),
  hubSubmissionController.submitExtension,
];
