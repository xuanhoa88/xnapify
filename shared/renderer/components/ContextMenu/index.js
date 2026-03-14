/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useEffect,
  useCallback,
  useState,
  createContext,
  useContext,
  useRef,
  forwardRef,
} from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

import Button from '../Button';
import { useRbac } from '../Rbac/useRbac';

// eslint-disable-next-line css-modules/no-unused-class -- dynamic classes
import s from './ContextMenu.css';

/**
 * ContextMenu - Reusable context menu component with composable sub-components
 * Supports both controlled (isOpen/onToggle) and uncontrolled internally managed state.
 */

const ContextMenuContext = createContext(null);

function ContextMenu({
  children,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  align = 'right',
  x = null,
  y = null,
  className,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const onToggle = useCallback(
    value => {
      if (isControlled && controlledOnToggle) {
        controlledOnToggle(value);
      } else if (!isControlled) {
        setInternalIsOpen(prev =>
          typeof value === 'function' ? value(prev) : value,
        );
      }
    },
    [isControlled, controlledOnToggle],
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = event => {
      // Don't close if clicking trigger (trigger handles its own toggle)
      if (triggerRef.current && triggerRef.current.contains(event.target)) {
        return;
      }
      // Don't close if clicking inside the menu itself
      if (menuRef.current && menuRef.current.contains(event.target)) {
        return;
      }
      onToggle(null);
    };

    // Need to use mousedown to capture before click events bubble up
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <ContextMenuContext.Provider
      value={{ isOpen, onToggle, align, x, y, triggerRef, menuRef }}
    >
      <div className={clsx(s.dropdown, { [s.open]: isOpen }, className)}>
        {children}
      </div>
    </ContextMenuContext.Provider>
  );
}

ContextMenu.propTypes = {
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func,
  align: PropTypes.oneOf(['left', 'right']),
  x: PropTypes.number,
  y: PropTypes.number,
  className: PropTypes.string,
};

// Trigger button
function Trigger({
  children,
  className,
  as: Component = Button,
  variant = 'ghost',
  ...props
}) {
  const ctx = useContext(ContextMenuContext);

  const handleClick = useCallback(
    e => {
      e.stopPropagation();
      e.preventDefault();
      ctx.onToggle(prev => !prev);
    },
    [ctx],
  );

  if (Component === Button) {
    return (
      <Button
        ref={ctx.triggerRef}
        variant={variant}
        className={clsx(s.trigger, className)}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Button>
    );
  }

  return (
    <Component
      ref={ctx.triggerRef}
      className={clsx(s.trigger, className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Component>
  );
}

Trigger.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.elementType,
  variant: PropTypes.string,
};

// Menu container
function Menu({ children, className }) {
  const ctx = useContext(ContextMenuContext);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 'auto' });

  // Calculate position when menu opens and update on scroll/resize
  useEffect(() => {
    if (!ctx.isOpen) return undefined;

    const updatePosition = () => {
      if (ctx.x !== null && ctx.y !== null) {
        // Explicit coordinates provided (e.g. for right-click context menus without a trigger button)
        setPosition({ top: ctx.y, left: ctx.x, right: 'auto' });
        return;
      }

      if (!ctx.triggerRef.current) return;

      const rect = ctx.triggerRef.current.getBoundingClientRect();
      const newPosition = {
        top: rect.bottom + 6,
      };

      if (ctx.align === 'right') {
        newPosition.right = window.innerWidth - rect.right;
        newPosition.left = 'auto';
      } else {
        newPosition.left = rect.left;
        newPosition.right = 'auto';
      }

      setPosition(newPosition);
    };

    updatePosition();

    // Re-calculate position strictly during any scrolling (capture phase to catch nested scroll areas)
    // or window resizing to ensure the fixed portal stays glued to the trigger button.
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [ctx.isOpen, ctx.align, ctx.triggerRef, ctx.x, ctx.y]);

  if (!ctx.isOpen) return null;

  return createPortal(
    <div
      ref={ctx.menuRef}
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
    </div>,
    document.body,
  );
}

Menu.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

// Header
function Header({ children, title, subtitle, className }) {
  return (
    <div className={clsx(s.header, className)}>
      {title && <div className={s.headerTitle}>{title}</div>}
      {subtitle && <div className={s.headerSubtitle}>{subtitle}</div>}
      {children}
    </div>
  );
}

Header.propTypes = {
  children: PropTypes.node,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  className: PropTypes.string,
};

// Menu item
const Item = forwardRef(
  (
    {
      children,
      onClick,
      icon,
      variant,
      disabled,
      className,
      permission,
      roles,
      groups,
      ownerId,
      as: Component = 'button',
      ...props
    },
    ref,
  ) => {
    const ctx = useContext(ContextMenuContext);
    const { hasPermission, hasRole, hasGroup, isOwner } = useRbac();

    const handleClick = useCallback(
      e => {
        e.stopPropagation();
        if (!disabled && onClick) {
          onClick(e);
        }
        if (!disabled) {
          ctx.onToggle(null);
        }
      },
      [onClick, disabled, ctx],
    );

    // Check permissions
    if (permission && !hasPermission(permission)) return null;
    if (roles && !hasRole(roles)) return null;
    if (groups && !hasGroup(groups)) return null;
    if (ownerId && !isOwner(ownerId)) return null;

    const ComponentType =
      Component !== 'button'
        ? Component
        : props.to || props.href
          ? 'a'
          : Component;

    return (
      <ComponentType
        ref={ref}
        role='menuitem'
        className={clsx(
          s.item,
          { [s[variant]]: variant, [s.disabled]: disabled },
          className,
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {icon && <span className={s.itemIcon}>{icon}</span>}
        {children}
      </ComponentType>
    );
  },
);

Item.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  icon: PropTypes.node,
  variant: PropTypes.oneOf(['danger', 'warning']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
  permission: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  roles: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  groups: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  ownerId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  as: PropTypes.elementType,
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  href: PropTypes.string,
};

Item.displayName = 'ContextMenu.Item';

// Divider
function Divider({ className }) {
  return <div className={clsx(s.divider, className)} role='separator' />;
}

Divider.propTypes = {
  className: PropTypes.string,
};

// Attach sub-components
ContextMenu.Trigger = Trigger;
ContextMenu.Menu = Menu;
ContextMenu.Header = Header;
ContextMenu.Item = Item;
ContextMenu.Divider = Divider;

export default ContextMenu;
