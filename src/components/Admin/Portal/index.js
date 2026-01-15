/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import Footer from '../Footer';
import Drawer from '../Drawer';
import Header from '../Header';
import FlashMessage from './FlashMessage';
import s from './Portal.css';

/**
 * Portal Component
 *
 * A dedicated layout component for admin panel pages.
 * Features Header, Drawer, Footer, and FlashMessage components.
 */
function Portal({ children }) {
  return (
    <div className={s.root}>
      <Header />
      <Drawer />
      <main className={s.content}>{children}</main>
      <FlashMessage />
      <Footer />
    </div>
  );
}

Portal.propTypes = {
  children: PropTypes.node,
};

export default Portal;
