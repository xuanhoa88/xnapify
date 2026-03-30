/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';

import s from './Loader.css';

/**
 * Loader Component
 *
 * A professional loading state component for admin pages.
 * Supports different variants: spinner, skeleton, pulse.
 */
function Loader({
  message = 'Loading...',
  variant = 'spinner',
  skeletonCount = 5,
  className,
}) {
  if (variant === 'skeleton') {
    return (
      <div className={clsx(s.root, className)}>
        <div className={s.skeletonContainer}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className={s.skeletonRow}>
              <div className={clsx(s.skeleton, s.skeletonAvatar)} />
              <div className={s.skeletonContent}>
                <div className={clsx(s.skeleton, s.skeletonTitle)} />
                <div className={clsx(s.skeleton, s.skeletonText)} />
              </div>
              <div className={clsx(s.skeleton, s.skeletonBadge)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className={clsx(s.root, className)}>
        <div className={s.cardsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className={s.cardSkeleton}>
              <div className={s.cardSkeletonHeader}>
                <div className={clsx(s.skeleton, s.skeletonTitle)} />
                <div className={clsx(s.skeleton, s.skeletonIcon)} />
              </div>
              <div className={clsx(s.skeleton, s.skeletonValue)} />
              <div className={clsx(s.skeleton, s.skeletonText)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: spinner variant
  return (
    <div className={clsx(s.root, s.spinnerSection, className)}>
      <div className={s.spinner}>
        <div className={s.spinnerRing} />
        <div className={s.spinnerRing} />
        <div className={s.spinnerRing} />
      </div>
      <p className={s.message}>{message}</p>
    </div>
  );
}

Loader.propTypes = {
  /** Loading message to display */
  message: PropTypes.string,
  /** Loading style variant */
  variant: PropTypes.oneOf(['spinner', 'skeleton', 'cards']),
  /** Number of skeleton rows for skeleton variant */
  skeletonCount: PropTypes.number,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default Loader;
