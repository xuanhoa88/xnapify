/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useCallback } from 'react';
import { useHistory } from './hooks';

// Check if URL is external (starts with http:// or https:// or //)
const isExternalUrl = url =>
  /^(https?:)?\/\//.test(url) || url.startsWith('mailto:');

// Check if click should trigger navigation
const shouldNavigate = event =>
  event.button === 0 && // Left click only
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.defaultPrevented;

/**
 * Link component for client-side navigation
 * - External links (http://, https://, mailto:) render as normal <a> tags
 * - Internal links use history for SPA navigation
 *
 * @param {Object} props
 * @param {string} props.to - Target URL or path
 * @param {boolean} [props.replace=false] - Use history.replace instead of push
 * @param {Function} [props.onClick] - Optional click handler
 * @param {React.ReactNode} [props.children] - Link content
 */
export function Link({ to, replace = false, children, onClick, ...props }) {
  const history = useHistory();

  const handleClick = useCallback(
    event => {
      // Call custom onClick if provided
      if (typeof onClick === 'function') {
        onClick(event);
      }

      // Only navigate for normal left clicks without modifiers
      if (!shouldNavigate(event)) return;

      event.preventDefault();
      replace ? history.replace(to) : history.push(to);
    },
    [onClick, to, replace, history],
  );

  // External links - render as normal anchor without click handler override
  if (isExternalUrl(to)) {
    return (
      <a href={to} {...props} onClick={onClick}>
        {children}
      </a>
    );
  }

  // Internal links - use history navigation
  return (
    <a href={to} {...props} onClick={handleClick}>
      {children}
    </a>
  );
}

Link.propTypes = {
  to: PropTypes.string.isRequired,
  replace: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node,
};
