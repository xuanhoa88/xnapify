import * as fileController from '../../../../controllers/file.controller';

// DELETE /api/files/trash/empty
export const del = fileController.emptyTrash;

export { del as delete };
