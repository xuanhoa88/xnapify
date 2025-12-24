/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import clsx from 'clsx';
import Icon from '../../../Icon';
import s from './Error.css';

/**
 * ErrorMessage Component
 *
 * A professional error state component for admin pages.
 * Displays an icon, error title, error details, and optional retry button.
 */
function Error({
  icon = 'alert-circle',
  title = 'Error loading data',
  error,
  retryLabel = 'Retry',
  onRetry,
  className,
}) {
  return (
    <div className={clsx(s.root, className)}>
      <div className={s.iconWrapper}>
        <Icon name={icon} size={48} />
      </div>
      <h3 className={s.title}>{title}</h3>
      {error && <p className={s.error}>{String(error)}</p>}
      {onRetry && (
        <button type='button' className={s.retryButton} onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

Error.propTypes = {
  /** Icon name to display */
  icon: PropTypes.string,
  /** Main title/message */
  title: PropTypes.string,
  /** Error message or error object */
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  /** Retry button label */
  retryLabel: PropTypes.string,
  /** Retry button click handler */
  onRetry: PropTypes.func,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default Error;
