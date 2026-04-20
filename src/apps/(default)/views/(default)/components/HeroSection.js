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

import { Link } from '@shared/renderer/components/History';

import s from './HeroSection.css';

/**
 * Modernized Hero banner leveraging Radix Section for padding handling and explicit buttons.
 */
function HeroSection() {
  const { t } = useTranslation();

  return (
    <Section size='4' className={clsx(s.heroSectionModern, s.textCenter)}>
      <Flex direction='column' align='center' className={s.heroContainer}>
        <Box mb='4' className={s.badgeLabel}>
          <Text size='3' weight='medium' color='indigo'>
            Fully Open Source & Extensible
          </Text>
        </Box>
        <Heading
          as='h1'
          size={{ initial: '8', md: '9' }}
          align='center'
          className={s.heroTitleModern}
        >
          {t('home.hero.title', 'xnapify')}
        </Heading>
        <Text
          size={{ initial: '4', md: '5' }}
          align='center'
          className={s.heroSubtitleModern}
        >
          {t(
            'home.hero.subtitle',
            'A modular, extensible platform with auto-discovered domains, dependency injection, file-based routing, and a runtime extension system',
          )}
        </Text>
        <Flex gap='4' justify='center' wrap='wrap' mt='6'>
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
