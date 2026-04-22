/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';

import { Flex, Text, Box } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import ScrollToTop from './ScrollToTop';

/**
 * Navigation links configuration
 */
const NAV_LINKS = [
  { to: '/about', key: 'navigation.about' },
  { to: '/privacy', key: 'navigation.privacy' },
  { to: '/contact', key: 'navigation.contact' },
  { to: '/not-found', key: 'navigation.notFound' },
  { to: '/error', key: 'navigation.error' },
];

/**
 * Footer Component
 * Site footer with navigation links and scroll-to-top button built on Radix Themes
 */
function Footer() {
  const { t } = useTranslation();

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <>
      <Box
        as='footer'
        px='4'
        py='6'
        className='bg-[var(--color-panel-solid)] border-t border-[var(--gray-a6)]'
      >
        <Flex
          align='center'
          justify='center'
          wrap='wrap'
          gap='3'
          maxWidth='1200px'
          m='0 auto'
          className='text-[var(--gray-11)]'
        >
          <Text size='3'>{t('footer.copyright', { year: currentYear })}</Text>

          {NAV_LINKS.map(link => (
            <Flex asChild align='center' gap='3' key={link.to}>
              <span>
                <Text size='3' color='gray'>
                  ·
                </Text>
                <Link
                  to={link.to}
                  className='text-[var(--gray-11)] no-underline text-[length:var(--font-size-2)] transition-colors duration-200 hover:text-[var(--indigo-11)]'
                >
                  {t(link.key)}
                </Link>
              </span>
            </Flex>
          ))}
        </Flex>
      </Box>

      <ScrollToTop />
    </>
  );
}

export default Footer;
