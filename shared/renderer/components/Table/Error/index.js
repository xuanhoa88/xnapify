/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Button from '../../Button';
import Icon from '../../Icon';

import s from './Error.css';

/**
 * ErrorMessage Component
 *
 * A professional error state component for admin pages.
 * Displays an icon, error title, error details, and optional retry button.
 */
function Error({
  icon = 'alert-circle',
  title,
  error,
  retryLabel,
  onRetry,
  className,
}) {
  const { t } = useTranslation();

  const displayTitle =
    title || t('shared:components.table.error.title', 'Error loading data');
  const displayRetryLabel =
    retryLabel || t('shared:components.table.error.retry', 'Retry');

  return (
    <div className={clsx(s.root, className)}>
      <div className={s.iconWrapper}>
        <Icon name={icon} size={48} />
      </div>
      <h3 className={s.title}>{displayTitle}</h3>
      {error && <p className={s.error}>{String(error)}</p>}
      {onRetry && (
        <Button variant='primary' onClick={onRetry}>
          {displayRetryLabel}
        </Button>
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
