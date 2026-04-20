/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { IconButton } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import s from './ToolbarButton.css';

/**
 * ToolbarButton — A single toolbar action button.
 */
const ToolbarButton = forwardRef(function ToolbarButton(
  { icon, title, isActive, onClick, disabled, className, children, ...props },
  ref,
) {
  return (
    <IconButton
      ref={ref}
      size='1'
      variant={isActive ? 'soft' : 'ghost'}
      color='gray'
      className={clsx(
        s.toolbarBtn,
        { [s.toolbarBtnActive]: isActive },
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      data-tooltip={title}
      aria-label={title}
      aria-pressed={isActive}
      {...props}
    >
      {icon}
      {children}
    </IconButton>
  );
});

ToolbarButton.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default ToolbarButton;
