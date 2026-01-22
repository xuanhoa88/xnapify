/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Back from './Back';
import Delete from './Delete';

/**
 * ConfirmModal - Namespace for confirmation modal components
 *
 * Usage:
 *   import { ConfirmModal } from '../../../components/Admin';
 *   <ConfirmModal.Back ref={confirmBackModalRef} onConfirm={handleConfirmBack} />
 *   <ConfirmModal.Delete
 *     ref={deleteModalRef}
 *     title="Delete User"
 *     getItemName={item => item.name}
 *     onDelete={item => dispatch(deleteUser(item.id))}
 *     onSuccess={handleDeleteSuccess}
 *   />
 */
const ConfirmModal = {
  Back,
  Delete,
};

export default ConfirmModal;
