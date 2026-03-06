/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as fileController from '../../../../controllers/file.controller';
import { requirePermission } from '../../utils';

// DELETE /api/files/trash/empty
export const del = [
  requirePermission('files:delete'),
  fileController.emptyTrash,
];

export { del as delete };
