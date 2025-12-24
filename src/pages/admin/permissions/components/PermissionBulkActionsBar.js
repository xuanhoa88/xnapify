/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import s from './PermissionBulkActionsBar.css';

function PermissionBulkActionsBar({
  count,
  onActivate,
  onDeactivate,
  onDelete,
  onClear,
}) {
  return (
    <div className={s.bulkActions}>
      <span className={s.bulkInfo}>{count} permission(s) selected</span>
      <button className={s.bulkBtn} onClick={onActivate}>
        Activate
      </button>
      <button className={s.bulkBtn} onClick={onDeactivate}>
        Deactivate
      </button>
      <button className={s.bulkBtnDanger} onClick={onDelete}>
        Delete
      </button>
      <button className={s.bulkClear} onClick={onClear}>
        ✕ Clear
      </button>
    </div>
  );
}

PermissionBulkActionsBar.propTypes = {
  count: PropTypes.number.isRequired,
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default PermissionBulkActionsBar;
