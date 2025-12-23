/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'normalize.css';
import PropTypes from 'prop-types';
import Footer from '../Footer';
import Sidebar from '../Sidebar';
import Header from '../Header';
import s from './Layout.css';

/**
 * AdminLayout Component
 *
 * A dedicated layout component for admin panel pages.
 * Features the AdminHeader and admin-specific styling.
 */
function AdminLayout({ children }) {
  return (
    <div className={s.root}>
      <Header />
      <Sidebar />
      <main className={s.content}>{children}</main>
      <Footer />
    </div>
  );
}

AdminLayout.propTypes = {
  children: PropTypes.node,
};

export default AdminLayout;
