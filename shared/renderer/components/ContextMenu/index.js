/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
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
  useLayoutEffect,
} from 'react';

import { Button, Box, Flex, Text, Theme } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import Portal from '../Portal';
import { useRbac } from '../Rbac/useRbac';

import s from './ContextMenu.css';

/**
 * ContextMenu - Reusable context menu component with composable sub-components baked by Radix Themes tokens
 * Supports both controlled (isOpen/onToggle) and uncontrolled internally managed state.
 */

const ContextMenuContext = createContext(null);

function useContextMenu(componentName) {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error(
      `ContextMenu.${componentName} must be used within a <ContextMenu> component`,
    );
  }
  return ctx;
}

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
      <Box className={clsx(className, s.container, isOpen && s.containerOpen)}>
        {children}
      </Box>
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
  const ctx = useContextMenu('Trigger');

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
        className={clsx(className, s.trigger)}
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
      className={clsx(className, s.trigger)}
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
  const ctx = useContextMenu('Menu');

  // Calculate position when menu opens and update on scroll/resize
  useLayoutEffect(() => {
    if (!ctx.isOpen) return undefined;

    const updatePosition = () => {
      if (!ctx.menuRef.current) return;

      if (ctx.x !== null && ctx.y !== null) {
        ctx.menuRef.current.style.top = `${ctx.y}px`;
        ctx.menuRef.current.style.left = `${ctx.x}px`;
        ctx.menuRef.current.style.right = 'auto';
        return;
      }

      if (!ctx.triggerRef.current) return;

      const rect = ctx.triggerRef.current.getBoundingClientRect();
      const top = rect.bottom + 6;
      let left = 'auto';
      let right = 'auto';

      if (ctx.align === 'right') {
        right = `${window.innerWidth - rect.right}px`;
      } else {
        left = `${rect.left}px`;
      }

      ctx.menuRef.current.style.top = `${top}px`;
      ctx.menuRef.current.style.left = left;
      ctx.menuRef.current.style.right = right;
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
  }, [ctx.isOpen, ctx.align, ctx.triggerRef, ctx.x, ctx.y, ctx.menuRef]);

  if (!ctx.isOpen) return null;

  return (
    <Portal>
      <Theme>
        <Box
          ref={ctx.menuRef}
          className={clsx(s.menu, className)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          role='menu'
          tabIndex={-1}
        >
          {children}
        </Box>
      </Theme>
    </Portal>
  );
}

Menu.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

// Header
function Header({ children, title, subtitle, className }) {
  return (
    <Box py='2' px='3' mb='1' className={clsx(className, s.header)}>
      {title && (
        <Text as='div' size='2' weight='bold'>
          {title}
        </Text>
      )}
      {subtitle && (
        <Text as='div' size='1' color='gray' mt='1'>
          {subtitle}
        </Text>
      )}
      {children}
    </Box>
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
    const ctx = useContextMenu('Item');
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
          disabled ? s.itemDisabled : '',
          variant === 'danger'
            ? s.itemDanger
            : variant === 'warning'
              ? s.itemWarning
              : s.itemDefault,
          className,
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {icon && (
          <Flex align='center' asChild>
            <span>{icon}</span>
          </Flex>
        )}
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
  return (
    <Box
      my='1'
      mx='1'
      className={clsx(className, s.divider)}
      role='separator'
    />
  );
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
