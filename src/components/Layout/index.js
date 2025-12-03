/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'normalize.css';
import PropTypes from 'prop-types';
import Feedback from '../Feedback';
import Footer from '../Footer';
import Header from '../Header';
import Sidebar from '../Sidebar';
import s from './Layout.css';

function Layout({ children }) {
  return (
    <div className={s.root}>
      <Header />
      <Sidebar />
      <main className={s.content}>{children}</main>
      <Feedback />
      <Footer />
    </div>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
