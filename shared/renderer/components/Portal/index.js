/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';

import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

/**
 * Portal - SSR-aware portal wrapper
 *
 * Returns null on the server and during hydration.
 * On the client, after mount, renders children via createPortal.
 */
export default function Portal({ children, container = null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    children,
    container || (typeof document !== 'undefined' ? document.body : null),
  );
}

Portal.propTypes = {
  children: PropTypes.node.isRequired,
  container: PropTypes.any,
};
