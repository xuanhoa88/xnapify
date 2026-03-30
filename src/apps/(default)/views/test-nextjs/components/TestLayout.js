/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import s from './TestLayout.css';

export default function TestLayout({ children }) {
  return (
    <div className={s.container}>
      <div className={s.header}>📦 Test Layout Wrapper</div>

      <div className={s.content}>{children}</div>

      <div className={s.footer}>
        💡 <strong>Layout Info:</strong> This blue border comes from the
        layout.js file. All pages under /test-nextjs/* will be wrapped with this
        layout automatically.
      </div>
    </div>
  );
}

TestLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
