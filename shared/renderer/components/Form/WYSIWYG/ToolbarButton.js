/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* eslint-disable css-modules/no-unused-class */
import clsx from 'clsx';
import PropTypes from 'prop-types';

import s from './ToolbarButton.css';

/**
 * ToolbarButton — A single toolbar action button.
 */
export default function ToolbarButton({
  icon,
  title,
  isActive,
  onClick,
  disabled,
}) {
  return (
    <button
      type='button'
      className={clsx(s.toolbarBtn, { [s.toolbarBtnActive]: isActive })}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
    >
      {icon}
    </button>
  );
}

ToolbarButton.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
