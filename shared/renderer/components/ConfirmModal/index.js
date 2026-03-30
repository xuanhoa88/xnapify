/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Action from './Action';
import Back from './Back';
import Delete from './Delete';
import Prompt from './Prompt';

/**
 * ConfirmModal - Namespace for confirmation modal components
 *
 * Usage:
 *   import ConfirmModal from '@shared/components/ConfirmModal';
 *   <ConfirmModal.Action ref={actionModalRef} title="..." onConfirm={...} />
 *   <ConfirmModal.Back ref={confirmBackModalRef} onConfirm={handleConfirmBack} />
 *   <ConfirmModal.Delete ... />
 *   <ConfirmModal.Prompt ... />
 */
const ConfirmModal = {
  Action,
  Back,
  Delete,
  Prompt,
};

export default ConfirmModal;
