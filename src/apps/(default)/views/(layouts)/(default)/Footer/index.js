/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo } from 'react';

import {
  TwitterLogoIcon,
  GitHubLogoIcon,
  DiscordLogoIcon,
} from '@radix-ui/react-icons';
import { Flex, Text, Box, Grid, Heading, Container } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import ScrollToTop from './ScrollToTop';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/features', key: 'navigation.features', defaultLabel: 'Features' },
      { to: '/pricing', key: 'navigation.pricing', defaultLabel: 'Pricing' },
      { to: '/about', key: 'navigation.about', defaultLabel: 'About Us' },
    ],
  },
  {
    title: 'Resources',
    links: [
      {
        to: '/docs',
        key: 'navigation.documentation',
        defaultLabel: 'Documentation',
      },
      {
        to: '/help',
        key: 'navigation.helpCenter',
        defaultLabel: 'Help Center',
      },
      { to: '/api', key: 'navigation.api', defaultLabel: 'API Reference' },
    ],
  },
  {
    title: 'Legal',
    links: [
      {
        to: '/privacy',
        key: 'navigation.privacy',
        defaultLabel: 'Privacy Policy',
      },
      {
        to: '/terms',
        key: 'navigation.terms',
        defaultLabel: 'Terms of Service',
      },
      { to: '/contact', key: 'navigation.contact', defaultLabel: 'Contact' },
    ],
  },
];

const SOCIAL_LINKS = [
  { icon: TwitterLogoIcon, href: 'https://twitter.com', label: 'Twitter' },
  {
    icon: GitHubLogoIcon,
    href: 'https://github.com/xuanhoa88/xnapify',
    label: 'GitHub',
  },
  { icon: DiscordLogoIcon, href: 'https://discord.com', label: 'Discord' },
];

/**
 * Footer Component
 * Professional, multi-column SaaS-style footer built with Radix Themes and Tailwind CSS
 */
function Footer() {
  const { t } = useTranslation();
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <>
      <Box
        as='footer'
        className='bg-[var(--color-panel-solid)] border-t border-[var(--gray-a6)] pt-12 pb-6 mt-16'
      >
        <Container size='4' px='4'>
          <Grid columns={{ initial: '1', md: '4', lg: '5' }} gap='8' mb='9'>
            {/* Brand Column */}
            <Box className='md:col-span-2 lg:col-span-2'>
              <Flex align='center' gap='2' mb='4'>
                <img
                  src='/xnapify_38x38.png'
                  alt='xnapify logo'
                  className='w-8 h-8 rounded'
                />
                <Text weight='bold' size='5' className='tracking-tight'>
                  xnapify
                </Text>
              </Flex>
              <Text
                size='3'
                className='text-[var(--gray-11)] block mb-6 max-w-sm leading-relaxed'
              >
                A modern, enterprise-grade boilerplate designed for
                high-performance React applications.
              </Text>
              <Flex gap='4'>
                {SOCIAL_LINKS.map(social => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target='_blank'
                      rel='noreferrer'
                      aria-label={social.label}
                      className='text-[var(--gray-11)] hover:text-[var(--indigo-11)] transition-colors duration-200'
                    >
                      <Icon width={20} height={20} />
                    </a>
                  );
                })}
              </Flex>
            </Box>

            {/* Navigation Columns */}
            {FOOTER_COLUMNS.map(column => (
              <Box key={column.title}>
                <Heading
                  as='h3'
                  size='3'
                  mb='4'
                  className='text-[var(--gray-12)]'
                >
                  {column.title}
                </Heading>
                <Flex direction='column' gap='3'>
                  {column.links.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className='text-[var(--gray-11)] text-[length:var(--font-size-2)] hover:text-[var(--indigo-11)] no-underline transition-colors duration-200'
                    >
                      {t(link.key, link.defaultLabel)}
                    </Link>
                  ))}
                </Flex>
              </Box>
            ))}
          </Grid>

          {/* Bottom Bar */}
          <Box className='pt-6 border-t border-[var(--gray-a6)] flex flex-col md:flex-row justify-between items-center gap-4'>
            <Text size='2' className='text-[var(--gray-11)]'>
              {t('footer.copyright', { year: currentYear })}
            </Text>
            <Flex gap='4'>
              <Link
                to='/not-found'
                className='text-[var(--gray-10)] text-xs hover:text-[var(--gray-12)] no-underline transition-colors'
              >
                {t('navigation.notFound', 'Not Found')}
              </Link>
              <Link
                to='/error'
                className='text-[var(--gray-10)] text-xs hover:text-[var(--gray-12)] no-underline transition-colors'
              >
                {t('navigation.error', 'Error Test')}
              </Link>
            </Flex>
          </Box>
        </Container>
      </Box>

      <ScrollToTop />
    </>
  );
}

export default Footer;
