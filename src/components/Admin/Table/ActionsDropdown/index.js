/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useEffect,
  useCallback,
  createContext,
  useContext,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import Button from '../../../Button';
// eslint-disable-next-line css-modules/no-unused-class -- right, left, danger, warning are accessed dynamically
import s from './ActionsDropdown.css';

/**
 * ActionsDropdown - Reusable actions dropdown component with composable sub-components
 *
 * Usage:
 *   <ActionsDropdown isOpen={isOpen} onToggle={handleToggle}>
 *     <ActionsDropdown.Trigger>⋮</ActionsDropdown.Trigger>
 *     <ActionsDropdown.Menu>
 *       <ActionsDropdown.Item onClick={handleAction} icon={<Icon name="edit" />}>
 *         Edit
 *       </ActionsDropdown.Item>
 *       <ActionsDropdown.Divider />
 *       <ActionsDropdown.Item onClick={handleDelete} variant="danger">
 *         Delete
 *       </ActionsDropdown.Item>
 *     </ActionsDropdown.Menu>
 *   </ActionsDropdown>
 */

// Context for sharing dropdown state
const ActionsDropdownContext = createContext(null);

// Root ActionsDropdown component
function ActionsDropdown({
  children,
  isOpen,
  onToggle,
  align = 'right',
  className,
}) {
  const triggerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = () => {
      onToggle(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <ActionsDropdownContext.Provider
      value={{ isOpen, onToggle, align, triggerRef }}
    >
      <div className={clsx(s.dropdown, { [s.open]: isOpen }, className)}>
        {children}
      </div>
    </ActionsDropdownContext.Provider>
  );
}

ActionsDropdown.propTypes = {
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  align: PropTypes.oneOf(['left', 'right']),
  className: PropTypes.string,
};

// Trigger button
function Trigger({ children, className, title = 'More actions', ...props }) {
  const ctx = useContext(ActionsDropdownContext);

  const handleClick = useCallback(
    e => {
      e.stopPropagation();
      ctx.onToggle(prev => !prev);
    },
    [ctx],
  );

  return (
    <Button
      ref={ctx.triggerRef}
      variant='ghost'
      iconOnly
      className={clsx(s.trigger, className)}
      onClick={handleClick}
      title={title}
      {...props}
    >
      {children}
    </Button>
  );
}

Trigger.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  title: PropTypes.string,
};

// Menu container - uses fixed positioning to avoid clipping by overflow containers
function Menu({ children, className }) {
  const ctx = useContext(ActionsDropdownContext);

  if (!ctx.isOpen) return null;

  // Calculate position synchronously when rendering
  const rect =
    ctx.triggerRef &&
    ctx.triggerRef.current &&
    ctx.triggerRef.current.getBoundingClientRect();

  const position = {
    top: rect ? rect.bottom + 6 : 0,
  };

  if (ctx.align === 'right') {
    position.right = rect ? window.innerWidth - rect.right : 0;
    position.left = 'auto';
  } else {
    position.left = rect ? rect.left : 0;
    position.right = 'auto';
  }

  return (
    <div
      className={clsx(s.menu, className)}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        right: position.right,
      }}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      role='menu'
      tabIndex={-1}
    >
      {children}
    </div>
  );
}

Menu.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

// Menu item
function Item({
  children,
  onClick,
  icon,
  variant,
  disabled,
  className,
  ...props
}) {
  const ctx = useContext(ActionsDropdownContext);

  const handleClick = useCallback(
    e => {
      e.stopPropagation();
      if (!disabled && onClick) {
        onClick(e);
        ctx.onToggle(null);
      }
    },
    [onClick, disabled, ctx],
  );

  return (
    <Button
      variant='unstyled'
      className={clsx(s.item, { [s[variant]]: variant }, className)}
      onClick={handleClick}
      disabled={disabled}
      {...props}
    >
      {icon && <span className={s.itemIcon}>{icon}</span>}
      {children}
    </Button>
  );
}

Item.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  icon: PropTypes.node,
  variant: PropTypes.oneOf(['danger', 'warning']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

// Divider
function Divider({ className }) {
  return <div className={clsx(s.divider, className)} role='separator' />;
}

Divider.propTypes = {
  className: PropTypes.string,
};

// Attach sub-components
ActionsDropdown.Trigger = Trigger;
ActionsDropdown.Menu = Menu;
ActionsDropdown.Item = Item;
ActionsDropdown.Divider = Divider;

export default ActionsDropdown;
