/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'normalize.css';
import PropTypes from 'prop-types';
import Footer from './Footer';
import Header from './Header';
import s from './Layout.css';

function Layout({ children }) {
  return (
    <div className={s.root}>
      <Header />
      <main className={s.content}>{children}</main>
      <Footer />
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node,
};

export default Layout;
