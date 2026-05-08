/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { GitHubLogoIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Button, Section } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History/index.js';

import s from './HeroSection.css';

/**
 * Modernized Hero banner leveraging Radix Section for padding handling and explicit buttons.
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
    <Section
      size='4'
      className={clsx(
        s.heroSectionModern,
        s.textCenter,
        'flex flex-col items-center justify-center',
      )}
    >
      <Flex
        direction='column'
        align='center'
        className={clsx(
          s.heroContainer,
          'flex flex-col items-center justify-center text-center mx-auto w-full',
        )}
      >
        <Box
          mb='4'
          className={clsx(
            s.badgeLabel,
            'inline-flex items-center justify-center',
          )}
        >
          <Text size='3' weight='medium' color='indigo'>
            Fully Open Source & Extensible
          </Text>
        </Box>
        <Heading
          as='h1'
          size={{ initial: '8', md: '9' }}
          align='center'
          className={clsx(s.heroTitleModern, 'text-center w-full')}
        >
          {t('home.hero.title', 'xnapify')}
        </Heading>
        <Text
          size={{ initial: '4', md: '5' }}
          align='center'
          className={clsx(s.heroSubtitleModern, 'text-center mx-auto w-full')}
        >
          {t(
            'home.hero.subtitle',
            'A modular, extensible platform with auto-discovered domains, dependency injection, file-based routing, and a runtime extension system',
          )}
        </Text>
        <Flex
          gap='4'
          justify='center'
          wrap='wrap'
          mt='6'
          className='w-full items-center justify-center flex-row'
        >
          <Button asChild size='4' variant='solid'>
            <Link to='/features'>
              {t('home.hero.exploreFeatures', 'Explore Features')}
              <ArrowRightIcon width={16} height={16} />
            </Link>
          </Button>
          <Button asChild size='4' variant='surface' color='gray'>
            <a
              href='https://github.com/xuanhoa88/xnapify'
              target='_blank'
              rel='noopener noreferrer'
            >
              <GitHubLogoIcon width={16} height={16} />
              {t('home.hero.viewGithub', 'View on GitHub')}
            </a>
          </Button>
        </Flex>
      </Flex>
    </Section>
  );
}

export default HeroSection;
