/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import s from './BulkActionsBar.css';

function BulkActionsBar({ count, onAssignRoles, onAssignGroups, onClear }) {
  return (
    <div className={s.bulkActions}>
      <span className={s.bulkInfo}>{count} user(s) selected</span>
      <button className={s.bulkBtn} onClick={onAssignRoles}>
        Assign Roles
      </button>
      <button className={s.bulkBtn} onClick={onAssignGroups}>
        Assign Groups
      </button>
      <button className={s.bulkClear} onClick={onClear}>
        ✕ Clear
      </button>
    </div>
  );
}

BulkActionsBar.propTypes = {
  count: PropTypes.number.isRequired,
  onAssignRoles: PropTypes.func.isRequired,
  onAssignGroups: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

export default BulkActionsBar;
