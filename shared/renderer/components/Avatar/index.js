/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import clsx from 'clsx';
import PropTypes from 'prop-types';

import Icon from '../Icon';

// eslint-disable-next-line css-modules/no-unused-class -- classes accessed dynamically via s[size] and s[variant]
import s from './Avatar.css';

/**
 * Get initials from full name
 * @param {string} fullName
 * @returns {string}
 */
const getInitials = fullName => {
  if (typeof fullName !== 'string') return '';
  const names = fullName.trim().split(/\s+/);
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

/**
 * Avatar - Displays user avatars with optional images, initials, or placeholder
 *
 * Usage:
 *   <Avatar src="/path/to/image.jpg" alt="John Doe" />
 *   <Avatar name="John Doe" /> // Shows "JD" initials
 *   <Avatar size="large" variant="square" />
 *   <Avatar name="Jane Smith" status="online" />
 */
function Avatar({
  src,
  alt = '',
  name = '',
  size = 'medium',
  variant = 'circle',
  status,
  className = '',
  ...props
}) {
  const initials = getInitials(name);

  return (
    <div
      className={clsx(s.avatar, s[size], s[variant], className)}
      title={alt || name}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt || name} className={s.image} />
      ) : initials ? (
        <span className={s.initials}>{initials}</span>
      ) : (
        <Icon name='user' className={s.placeholder} />
      )}
      {status && (
        <span
          className={clsx(
            s.status,
            s[`status${status.charAt(0).toUpperCase() + status.slice(1)}`],
          )}
        />
      )}
    </div>
  );
}

Avatar.propTypes = {
  /** Image source URL */
  src: PropTypes.string,
  /** Alt text for the image */
  alt: PropTypes.string,
  /** Full name for generating initials */
  name: PropTypes.string,
  /** Avatar size */
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xlarge']),
  /** Avatar shape variant */
  variant: PropTypes.oneOf(['circle', 'square', 'rounded']),
  /** Online status indicator */
  status: PropTypes.oneOf(['online', 'offline', 'away', 'busy']),
  /** Additional CSS class names */
  className: PropTypes.string,
};

export default Avatar;
