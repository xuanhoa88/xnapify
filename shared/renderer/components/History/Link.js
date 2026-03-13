/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import PropTypes from 'prop-types';

import { useHistory, buildUrl } from './hooks';

/**
 * Checks if a URL points to an external resource or uses a non-navigable protocol.
 * @param {string} url
 * @returns {boolean}
 */
const isExternalUrl = url => {
  if (!url || typeof url !== 'string') return false;
  // Protocol-relative or absolute URLs
  if (/^(https?:)?\/\//.test(url)) return true;
  // Non-HTTP protocols
  if (/^(mailto|tel|ftp|data|blob):/.test(url)) return true;
  return false;
};

/**
 * Determines if a click event should trigger client-side navigation.
 * Returns false for right-clicks, modifier keys, prevented events,
 * links with target="_blank", and download links.
 * @param {MouseEvent} event
 * @returns {boolean}
 */
const shouldNavigate = event => {
  if (!event || event.defaultPrevented) return false;
  if (event.button !== 0) return false; // Left click only
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    return false;

  // Check for target="_blank" or download attribute on the element
  const target = event.currentTarget || event.target;
  if (target) {
    if (target.getAttribute('target') === '_blank') return false;
    if (target.hasAttribute('download')) return false;
  }

  return true;
};

/**
 * Link component for client-side navigation.
 * Supports route param substitution, query params, and hash fragments via buildUrl.
 * Polymorphic — pass `as` to render as a different element or custom component.
 *
 * @param {Object} props
 * @param {string|React.ComponentType} [props.as='a'] - Element or component to render
 * @param {string} props.to - Target URL pattern (e.g. '/users/:id')
 * @param {Object} [props.params] - Route params to substitute (e.g. { id: 123 })
 * @param {Object} [props.query] - Query params (e.g. { page: 2 })
 * @param {string} [props.hash] - URL hash fragment (e.g. 'section-1')
 * @param {boolean} [props.swap=false] - Swap current history entry instead of pushing
 * @param {Function} [props.onClick] - Optional click handler
 * @param {React.ReactNode} [props.children] - Link content
 *
 * @example
 * // Default <a> tag
 * <Link to="/about">About</Link>
 *
 * // As a button
 * <Link as="button" to="/dashboard">Go</Link>
 *
 * // As a custom component
 * <Link as={MyButton} to="/users/:id" params={{ id: 123 }}>Profile</Link>
 */
export function Link({
  as: Component = 'a',
  to,
  params,
  query,
  hash,
  swap = false,
  children,
  onClick,
  ...props
}) {
  const history = useHistory();

  // Build final URL from pattern + params/query/hash
  const href = useMemo(() => {
    if (params || query || hash) {
      return buildUrl(to, { params, query, hash });
    }
    return to;
  }, [to, params, query, hash]);

  const handleClick = useCallback(
    event => {
      // Bail early for right-clicks, modifier keys, target=_blank, etc.
      if (!shouldNavigate(event)) {
        if (typeof onClick === 'function') onClick(event);
        return;
      }

      // Let custom handler run — it may call event.preventDefault()
      if (typeof onClick === 'function') {
        onClick(event);
        if (event.defaultPrevented) return;
      }

      event.preventDefault();
      if (swap) {
        history.replace(href);
      } else {
        history.push(href);
      }
    },
    [onClick, href, swap, history],
  );

  // External links — render as normal anchor
  if (isExternalUrl(to)) {
    return (
      <Component href={to} {...props} onClick={onClick}>
        {children}
      </Component>
    );
  }

  // For <a> tags, pass href directly
  // For other elements/components, pass href as data-href to avoid invalid HTML
  const linkProps =
    Component === 'a'
      ? { href, ...props }
      : {
          'data-href': href,
          type: Component === 'button' ? 'button' : undefined,
          ...props,
        };

  return (
    <Component {...linkProps} onClick={handleClick}>
      {children}
    </Component>
  );
}

Link.propTypes = {
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  to: PropTypes.string.isRequired,
  params: PropTypes.object,
  query: PropTypes.object,
  hash: PropTypes.string,
  swap: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node,
};
