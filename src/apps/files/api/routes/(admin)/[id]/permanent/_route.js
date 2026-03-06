import * as fileController from '../../../../controllers/file.controller';

// DELETE /api/files/:id/permanent
export const del = fileController.deletePermanent;

export { del as delete };
