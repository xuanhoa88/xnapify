/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './TestLayout.css';

/**
 * TestLayout utilizing simple Box layouts dropping pure layout bindings.
 */
export default function TestLayout({ children }) {
  return (
    <Box className={s.layoutWrapper}>
      <Box className={s.layoutHeader}>📦 Test Layout Wrapper</Box>

      <Box className={s.layoutContent}>{children}</Box>

      <Box className={s.layoutFooter}>
        💡 <strong>Layout Info:</strong> This blue border comes from the
        layout.js file. All pages under /test-nextjs/* will be wrapped with this
        layout automatically.
      </Box>
    </Box>
  );
}

TestLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
