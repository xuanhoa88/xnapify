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

/**
 * AdminLayout Component
 *
 * A dedicated layout component for admin panel pages using Radix UI primitives.
 * Features a persistent Sider (Drawer), Header, Footer, and FlashMessage.
 */
function AdminLayout({ children, minimal = true }) {
  return (
    <Flex minHeight='100vh' className='bg-[#f4f7fa]'>
      <Drawer minimal={minimal} />

      <Flex
        direction='column'
        minHeight='100vh'
        grow='1'
        className='transition-[margin-left,width] duration-200 ease-in-out'
        style={{
          marginLeft: `var(--sider-width, ${minimal ? '64px' : '240px'})`,
          width: `calc(100% - var(--sider-width, ${minimal ? '64px' : '240px'}))`,
        }}
      >
        <ImpersonationBanner />
        <Header />

        <Box as='main' className='flex-1 overflow-x-hidden'>
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
