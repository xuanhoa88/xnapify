/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useCallback } from 'react';
import * as navigator from '../../navigator';

function isLeftClickEvent(event) {
  return event.button === 0;
}

function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

// eslint-disable-next-line react/prop-types
function Link({ to, children, onClick = null, ...props }) {
  const handleClick = useCallback(
    event => {
      if (onClick) {
        onClick(event);
      }

      if (isModifiedEvent(event) || !isLeftClickEvent(event)) {
        return;
      }

      if (event.defaultPrevented === true) {
        return;
      }

      event.preventDefault();
      navigator.navigateTo(to);
    },
    [onClick, to],
  );

  return (
    <a href={to} {...props} onClick={handleClick}>
      {children}
    </a>
  );
}

Link.propTypes = {
  to: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

export default Link;
