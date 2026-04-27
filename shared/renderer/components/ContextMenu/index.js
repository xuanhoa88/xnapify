/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { forwardRef } from 'react';

import { DropdownMenu, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import Icon from '../Icon';
import { useRbac } from '../Rbac/useRbac';

import s from './ContextMenu.css';

/**
 * ContextMenu – Composable dropdown backed by Radix Themes DropdownMenu.
 *
 * Supports both controlled (isOpen/onToggle) and uncontrolled state.
 * All toggle, outside-click, focus-trap, and positioning logic is
 * delegated to Radix, eliminating the custom race-condition-prone code.
 */

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function ContextMenu({ children, isOpen, onToggle, modal = false }) {
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={onToggle} modal={modal}>
      {children}
    </DropdownMenu.Root>
  );
}

ContextMenu.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func,
  modal: PropTypes.bool,
};

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

function Trigger({ children, className, asChild, ...props }) {
  if (asChild) {
    return (
      <DropdownMenu.Trigger asChild className={className} {...props}>
        {children}
      </DropdownMenu.Trigger>
    );
  }

  return (
    <DropdownMenu.Trigger asChild>
      <button
        type='button'
        {...props}
        className={clsx(className, s.trigger, 'rt-reset', 'rt-BaseButton')}
      >
        {children}
      </button>
    </DropdownMenu.Trigger>
  );
}

Trigger.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  asChild: PropTypes.bool,
};

// ---------------------------------------------------------------------------
// Menu (→ DropdownMenu.Content)
// ---------------------------------------------------------------------------

function Menu({
  children,
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}) {
  return (
    <DropdownMenu.Content
      align={align}
      sideOffset={sideOffset}
      className={className}
      {...props}
    >
      {children}
    </DropdownMenu.Content>
  );
}

Menu.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  align: PropTypes.oneOf(['start', 'center', 'end']),
  sideOffset: PropTypes.number,
};

// ---------------------------------------------------------------------------
// Header (→ DropdownMenu.Label)
// ---------------------------------------------------------------------------

function Header({ children, title, subtitle, className }) {
  return (
    <DropdownMenu.Label className={clsx(className, s.header)}>
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
    </DropdownMenu.Label>
  );
}

Header.propTypes = {
  children: PropTypes.node,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  className: PropTypes.string,
};

// ---------------------------------------------------------------------------
// Item (→ DropdownMenu.Item)
// ---------------------------------------------------------------------------

const VARIANT_COLOR_MAP = {
  danger: 'red',
  warning: 'yellow',
};

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
      shortcut,
      // Consume legacy props so they don't spread to the DOM.
      // eslint-disable-next-line no-unused-vars
      as,
      asChild,
      ...props
    },
    ref,
  ) => {
    const { hasPermission, hasRole, hasGroup, isOwner } = useRbac();

    // Check permissions — render nothing when unauthorized.
    if (permission && !hasPermission(permission)) return null;
    if (roles && !hasRole(roles)) return null;
    if (groups && !hasGroup(groups)) return null;
    if (ownerId && !isOwner(ownerId)) return null;

    const color = VARIANT_COLOR_MAP[variant];

    if (asChild) {
      return (
        <DropdownMenu.Item
          ref={ref}
          color={color}
          disabled={disabled}
          shortcut={shortcut}
          className={clsx(s.item, className)}
          onSelect={onClick}
          asChild
          {...props}
        >
          {children}
        </DropdownMenu.Item>
      );
    }

    return (
      <DropdownMenu.Item
        ref={ref}
        color={color}
        disabled={disabled}
        shortcut={shortcut}
        className={clsx(s.item, className)}
        onSelect={onClick}
        {...props}
      >
        {icon && (
          <Flex align='center' justify='center'>
            <Icon name={icon} size={16} />
          </Flex>
        )}
        {children}
      </DropdownMenu.Item>
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
  shortcut: PropTypes.string,
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

// ---------------------------------------------------------------------------
// Divider (→ DropdownMenu.Separator)
// ---------------------------------------------------------------------------

function Divider({ className }) {
  return <DropdownMenu.Separator className={className} />;
}

Divider.propTypes = {
  className: PropTypes.string,
};

// ---------------------------------------------------------------------------
// Attach sub-components
// ---------------------------------------------------------------------------

ContextMenu.Trigger = Trigger;
ContextMenu.Menu = Menu;
ContextMenu.Header = Header;
ContextMenu.Item = Item;
ContextMenu.Divider = Divider;

export default ContextMenu;
