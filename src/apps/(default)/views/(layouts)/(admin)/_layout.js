/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import ImpersonationBanner from '../components/ImpersonationBanner';

import Drawer from './Drawer';
import FlashMessage from './FlashMessage';
import Footer from './Footer';
import Header from './Header';

import s from './AdminLayout.css';

/**
 * AdminLayout Component
 *
 * A dedicated layout component for admin panel pages using Radix UI primitives.
 * Features a persistent Sider (Drawer), Header, Footer, and FlashMessage.
 */
function AdminLayout({ children, minimal = true }) {
  return (
    <Flex minHeight='100vh' className={s.layoutWrapper}>
      <Drawer minimal={minimal} />

      <Flex direction='column' grow='1' className={s.mainContent}>
        <ImpersonationBanner />
        <Header />

        <Box as='main' grow='1' px='6' py='4' overflowX='hidden'>
          {children}
        </Box>

        <FlashMessage />
        <Footer />
      </Flex>
    </Flex>
  );
}

AdminLayout.propTypes = {
  children: PropTypes.node,
  minimal: PropTypes.bool,
};

export default AdminLayout;
