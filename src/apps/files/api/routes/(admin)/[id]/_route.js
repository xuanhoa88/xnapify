import * as fileController from '../../../controllers/file.controller';

// DELETE /api/files/:id
export const del = fileController.trashFile;

export { del as delete };
