/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import s from './BulkActionsBar.css';

/**
 * Reusable bulk actions bar component for table selection actions.
 *
 * @param {object} props - Component props
 * @param {number} props.count - Number of selected items
 * @param {string} [props.itemLabel='item'] - Singular label for items (e.g., "user", "permission")
 * @param {Array<{label: string, onClick: Function, variant?: 'default'|'danger'}>} props.actions - Action buttons
 * @param {Function} props.onClear - Clear selection callback
 */
function BulkActionsBar({ count, itemLabel = 'item', actions, onClear }) {
  const pluralLabel = count === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className={s.bulkActions}>
      <span className={s.bulkInfo}>
        {count} {pluralLabel} selected
      </span>
      {actions.map(action => (
        <button
          key={action.label}
          className={action.variant === 'danger' ? s.bulkBtnDanger : s.bulkBtn}
          onClick={action.onClick}
          type='button'
        >
          {action.label}
        </button>
      ))}
      <button className={s.bulkClear} onClick={onClear} type='button'>
        ✕ Clear
      </button>
    </div>
  );
}

BulkActionsBar.propTypes = {
  count: PropTypes.number.isRequired,
  itemLabel: PropTypes.string,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      variant: PropTypes.oneOf(['default', 'danger']),
    }),
  ).isRequired,
  onClear: PropTypes.func.isRequired,
};

export default BulkActionsBar;
