/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
// eslint-disable-next-line css-modules/no-unused-class -- classes accessed dynamically via s[variant] and s[size]
import s from './Button.css';

/**
 * Button - Reusable button component with multiple variants and sizes
 *
 * Usage:
 *   <Button variant="primary" onClick={handleClick}>Click Me</Button>
 *   <Button variant="outline" size="small">Small Button</Button>
 *   <Button variant="danger" loading>Deleting...</Button>
 *   <Button as="a" href="/path" variant="secondary">Link Button</Button>
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'medium',
    type = 'button',
    disabled = false,
    loading = false,
    fullWidth = false,
    iconOnly = false,
    className = '',
    as: Component = 'button',
    ...props
  },
  ref,
) {
  // Use button-specific props only for button elements
  const buttonProps =
    Component === 'button'
      ? {
          type,
          disabled: disabled || loading,
        }
      : {};

  return (
    <Component
      ref={ref}
      className={clsx(
        s.button,
        s[variant],
        s[size],
        { [s.fullWidth]: fullWidth },
        { [s.loading]: loading },
        { [s.iconOnly]: iconOnly },
        className,
      )}
      {...buttonProps}
      {...props}
    >
      {loading && <span className={s.loadingSpinner} />}
      {children}
    </Component>
  );
});

Button.propTypes = {
  /** Button content */
  children: PropTypes.node.isRequired,
  /** Visual style variant */
  variant: PropTypes.oneOf([
    'primary',
    'secondary',
    'outline',
    'ghost',
    'danger',
    'success',
    'unstyled',
  ]),
  /** Button size */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** HTML button type attribute (only for button elements) */
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Loading state with spinner */
  loading: PropTypes.bool,
  /** Full width button */
  fullWidth: PropTypes.bool,
  /** Icon only button (square padding) */
  iconOnly: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string,
  /** Element type to render as (button, a, etc.) */
  as: PropTypes.elementType,
};

export default Button;
