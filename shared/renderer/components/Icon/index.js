/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { memo } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import PropTypes from 'prop-types';

import s from './Icon.css';

/**
 * Reusable Icon component using @radix-ui/react-icons
 * Provides consistent SVG icons mapped from legacy names to Radix primitives.
 *
 * Supports two modes:
 * 1. Built-in icons: pass a legacy name (e.g. 'check') or native Radix name ('CheckIcon')
 * 2. External images: pass a URL or path (starts with `/` or `http`)
 *    — useful for extension-provided icons served via static routes
 */

/**
 * Check if a value is an external icon reference (URL or path).
 * Extensions can provide custom icons via their static asset routes
 * (e.g., `/api/extensions/:id/static/icon.svg`).
 */
function isExternalIcon(name) {
  return (
    typeof name === 'string' &&
    (name.startsWith('/') ||
      name.startsWith('http') ||
      name.startsWith('data:image/'))
  );
}

function Icon({ name, size = 20, className, title, ...rest }) {
  // External icon: render as <img> for extension-provided assets
  if (isExternalIcon(name)) {
    const combinedClass = className
      ? `${className} ${s.externalIcon}`
      : s.externalIcon;
    return (
      <img
        src={name}
        alt={title || ''}
        width={size}
        height={size}
        className={combinedClass}
        {...rest}
      />
    );
  }

  // Load from explicit mapping, try native name, fallback to a neutral box
  const Component = RadixIcons[name] || RadixIcons.BoxIcon;

  // Dev-mode warning for unknown icon names
  if (!RadixIcons[name] && __DEV__) {
    console.warn(`[Icon] Unknown icon name: "${name}"`);
  }

  return (
    <Component
      width={size}
      height={size}
      className={className}
      aria-hidden={!title}
      {...(title ? { 'aria-label': title } : {})}
      {...rest}
    />
  );
}

Icon.propTypes = {
  name: (props, propName, componentName) => {
    const value = props[propName];
    if (value == null) {
      return new Error(
        `The prop \`${propName}\` is marked as required in ` +
          `\`${componentName}\`, but its value is \`${value}\`.`,
      );
    }
    if (typeof value === 'string') {
      return null;
    }
    return new Error(
      `Invalid prop \`${propName}\` supplied to \`${componentName}\`. ` +
        `Expected a built-in icon name or an external URL/path. Got: "${value}"`,
    );
  },
  size: PropTypes.number,
  className: PropTypes.string,
  title: PropTypes.string,
};

export default memo(Icon);
