/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import ImpersonationBanner from '../components/ImpersonationBanner';

import Drawer, { SIDER_WIDTH, SIDER_MINIMAL_WIDTH } from './Drawer';
import FlashMessage from './FlashMessage';
import Footer from './Footer';
import Header from './Header';

import s from './Admin.css';

/**
 * AdminLayout Component
 *
 * A dedicated layout component for admin panel pages.
 * Features a persistent Sider (Drawer), Header, Footer, and FlashMessage.
 */
function AdminLayout({ children, minimal = true }) {
  return (
    <div
      className={s.root}
      style={{
        '--sider-width': `${minimal ? SIDER_MINIMAL_WIDTH : SIDER_WIDTH}px`,
      }}
    >
      <Drawer minimal={minimal} />
      <div className={s.body}>
        <ImpersonationBanner />
        <Header />
        <main className={s.content}>{children}</main>
        <FlashMessage />
        <Footer />
      </div>
    </div>
  );
}

AdminLayout.propTypes = {
  children: PropTypes.node,
  minimal: PropTypes.bool,
};

export default AdminLayout;
