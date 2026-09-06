/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import FlashMessage from '../components/FlashMessage.js';
import ImpersonationBanner from '../components/ImpersonationBanner.js';

import Footer from './Footer/index.js';
import Header from './Header/index.js';

function DefaultLayout({ children }) {
  return (
    <Flex direction='column' minHeight='100vh'>
      <ImpersonationBanner />
      <Header />
      <Box as='main' grow='1'>
        {children}
      </Box>
      <Footer />
      <FlashMessage />
    </Flex>
  );
}

DefaultLayout.propTypes = {
  children: PropTypes.node,
};

export default DefaultLayout;
