/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import clsx from 'clsx';
import Icon from '../../Icon';
import s from './Empty.css';

/**
 * Empty Component
 *
 * A professional empty state component for admin pages.
 * Displays an icon, message, description, and optional action button.
 */
function Empty({
  icon = 'inbox',
  title = 'No items found',
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={clsx(s.root, className)}>
      <div className={s.iconWrapper}>
        <Icon name={icon} size={48} />
      </div>
      <h3 className={s.title}>{title}</h3>
      {description && <p className={s.description}>{description}</p>}
      {actionLabel && onAction && (
        <button type='button' className={s.actionButton} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

Empty.propTypes = {
  /** Icon name to display */
  icon: PropTypes.string,
  /** Main title/message */
  title: PropTypes.string,
  /** Optional description text */
  description: PropTypes.string,
  /** Optional action button label */
  actionLabel: PropTypes.string,
  /** Optional action button click handler */
  onAction: PropTypes.func,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default Empty;
