/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Back from './Back';
import Delete from './Delete';
import Prompt from './Prompt';

/**
 * ConfirmModal - Namespace for confirmation modal components
 *
 * Usage:
 *   import ConfirmModal from '@shared/components/ConfirmModal';
 *   <ConfirmModal.Back ref={confirmBackModalRef} onConfirm={handleConfirmBack} />
 *   <ConfirmModal.Delete ... />
 *   <ConfirmModal.Prompt ... />
 */
const ConfirmModal = {
  Back,
  Delete,
  Prompt,
};

export default ConfirmModal;
