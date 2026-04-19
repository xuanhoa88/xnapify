/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import AuthSwitcher from './AuthSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

import s from './Header.css';

/**
 * Header Component
 *
 * Main navigation header with brand, language switcher, and user authentication.
 * Shows login/register buttons for guests and profile dropdown for authenticated users.
 */
function Header() {
  const { t } = useTranslation();

  return (
    <Box as='header' position='sticky' top='0' className={s.headerBox}>
      <Flex
        align='center'
        justify='between'
        px={{ initial: '4', md: '6' }}
        height='64px'
        width='100%'
      >
        {/* Left: Brand */}
        <Flex align='center' gap='6'>
          <Link to='/' className={s.brandLink}>
            <Flex align='center' gap='2'>
              <img
                src='/xnapify_38x38.png'
                srcSet='/xnapify_72x72.png 2x'
                width='38'
                height='38'
                alt='xnapify'
              />
              <Text size='4' weight='bold'>
                {t('header.brand')}
              </Text>
            </Flex>
          </Link>

          {/* Desktop Navigation */}
          <Box as='nav' display={{ initial: 'none', md: 'block' }}>
            <Flex align='center' gap='2'>
              <Link to='/docs' className={s.navLink}>
                Documentation
              </Link>
              <Link to='/features' className={s.navLink}>
                Features
              </Link>
              <a
                href='https://github.com/xuanhoa88/xnapify'
                target='_blank'
                rel='noreferrer'
                className={s.navLink}
              >
                GitHub
              </a>
            </Flex>
          </Box>
        </Flex>

        {/* Right: Language Switcher + Auth Switcher */}
        <Flex align='center' gap='4'>
          <LanguageSwitcher />
          <Box className={s.navDivider} />
          <AuthSwitcher />
        </Flex>
      </Flex>
    </Box>
  );
}

export default Header;
