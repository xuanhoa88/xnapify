import * as fileController from '../../../controllers/file.controller';

export const post = [
  (req, res, next) => {
    const fs = req.app.get('fs');
    return fs.useUploadMiddleware({
      fieldName: 'file',
      maxSize: 50 * 1024 * 1024,
    })(req, res, next);
  },
  fileController.uploadFile,
];
