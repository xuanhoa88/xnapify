import * as fileController from '../../../../controllers/file.controller';

// PUT /api/files/:id/star
export const put = fileController.toggleStar;
