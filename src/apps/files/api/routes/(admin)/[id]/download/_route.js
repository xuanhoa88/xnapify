import * as fileController from '../../../../controllers/file.controller';

// GET /api/files/:id/download
export const get = fileController.downloadFile;
