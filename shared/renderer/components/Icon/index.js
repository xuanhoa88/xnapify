/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { memo, isValidElement, cloneElement } from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';

/**
 * Reusable Icon component
 * Provides consistent SVG icons with customizable size and color.
 *
 * Supports two modes:
 * 1. Built-in icons: pass a name from the `ICONS` registry
 * 2. External images: pass a URL or path (starts with `/` or `http`)
 *    — useful for extension-provided icons served via static routes
 */

// Dynamically import all icon packs from the paths directory
const iconsContext = require.context('./types', false, /\.js$/);

// Icon registry organized alphabetically
const ICONS = Object.freeze(
  iconsContext.keys().reduce((acc, key) => {
    return { ...acc, ...iconsContext(key).default };
  }, {}),
);

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

function Icon({
  name,
  size = 20,
  strokeWidth,
  className,
  style,
  title,
  ...rest
}) {
  const cls = clsx(className);

  // External icon: render as <img> for extension-provided assets
  if (isExternalIcon(name)) {
    return (
      <img
        src={name}
        alt={title || ''}
        width={size}
        height={size}
        className={cls || undefined}
        style={{ objectFit: 'contain', ...style }}
        {...rest}
      />
    );
  }

  const icon = ICONS[name];

  // Dev-mode warning for unknown icon names
  if (!icon && __DEV__) {
    console.warn(`[Icon] Unknown icon name: "${name}"`);
  }

  // Normalize to array for uniform rendering
  const iconNodes = icon ? (Array.isArray(icon) ? icon : [icon]) : [];

  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth || '2'}
      strokeLinecap='round'
      strokeLinejoin='round'
      xmlns='http://www.w3.org/2000/svg'
      className={cls || undefined}
      style={style}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      {...(title ? { 'aria-label': title } : {})}
      {...rest}
    >
      {title && <title>{title}</title>}
      {iconNodes.map((d, i) => {
        if (isValidElement(d)) return cloneElement(d, { key: i });
        return <path key={i} d={d} />;
      })}
    </svg>
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
    // Allow built-in icon names OR external paths/URLs
    if (typeof value === 'string' && (isExternalIcon(value) || ICONS[value])) {
      return null;
    }
    return new Error(
      `Invalid prop \`${propName}\` supplied to \`${componentName}\`. ` +
        `Expected a built-in icon name or an external URL/path. Got: "${value}"`,
    );
  },
  size: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
  title: PropTypes.string,
  strokeWidth: PropTypes.number,
};

export default memo(Icon);
