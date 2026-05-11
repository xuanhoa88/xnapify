/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History/index.js';

import AuthSwitcher from './AuthSwitcher/index.js';
import LanguageSwitcher from './LanguageSwitcher/index.js';

// Reusable NavLink component
const NavLink = ({ to, href, children }) => {
  const baseClasses =
    'relative px-3 py-1.5 text-[14px] font-medium text-(--gray-11) transition-colors duration-200 hover:text-(--gray-12) rounded-md hover:bg-(--gray-a3) no-underline';

  if (href) {
    return (
      <a href={href} target='_blank' rel='noreferrer' className={baseClasses}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={baseClasses}>
      {children}
    </Link>
  );
};

NavLink.propTypes = {
  to: PropTypes.string,
  href: PropTypes.string,
  children: PropTypes.node,
};

/**
 * Header Component
 *
 * Main navigation header with brand, language switcher, and user authentication.
 * Shows login/register buttons for guests and profile dropdown for authenticated users.
 */
function Header() {
  const { t } = useTranslation();

  return (
    <Box
      as='header'
      position='sticky'
      top='0'
      className='z-100 w-full bg-(--color-panel-translucent) backdrop-blur-xl border-b border-(--gray-a5) shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]'
    >
      <Flex
        align='center'
        justify='between'
        px={{ initial: '4', md: '6' }}
        height='64px'
        width='100%'
        className='max-w-[1400px] mx-auto'
      >
        {/* Left: Brand */}
        <Flex align='center' gap='6'>
          <Link
            to='/'
            className='group no-underline text-(--gray-12) transition-all active:scale-95'
          >
            <Flex align='center' gap='2'>
              <img
                src='/xnapify_38x38.png'
                srcSet='/xnapify_72x72.png 2x'
                width='38'
                height='38'
                alt='xnapify'
                className='group-hover:scale-105 transition-transform duration-300'
              />
              <Text
                size='4'
                weight='bold'
                className='tracking-tight group-hover:text-(--indigo-11) transition-colors'
              >
                {t('header.brand')}
              </Text>
            </Flex>
          </Link>

          {/* Desktop Navigation */}
          <Box as='nav' display={{ initial: 'none', md: 'block' }}>
            <Flex align='center' gap='1'>
              <NavLink to='/docs'>Documentation</NavLink>
              <NavLink to='/features'>Features</NavLink>
              <NavLink href='https://github.com/xuanhoa88/xnapify'>
                GitHub
              </NavLink>
            </Flex>
          </Box>
        </Flex>

        {/* Right: Language Switcher + Auth Switcher */}
        <Flex align='center' gap='3'>
          <LanguageSwitcher />
          <Box className='w-px h-5 bg-(--gray-a6) mx-1' />
          <AuthSwitcher />
        </Flex>
      </Flex>
    </Box>
  );
}

export default Header;
