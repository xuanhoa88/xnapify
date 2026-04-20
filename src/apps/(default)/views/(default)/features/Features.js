/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Container } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import { featuresData } from '../data';

import s from './Features.css';

/**
 * Premium Features listing showcasing a maximalist typography hero and a dynamic,
 * asymmetrical grid layout to highlight architectural capabilities.
 */
function Features() {
  const { t } = useTranslation();

  return (
    <Box className={s.pageWrapper}>
      {/* Dramatic Hero Section */}
      <Box as='section' className={clsx(s.heroSection, s.sectionPadding)}>
        <Container size='4'>
          <Flex direction='column' className={s.heroContent}>
            <Heading as='h1' className={s.heroTitle}>
              {t('features.hero.title', 'Architecture that scales.')}
            </Heading>
            <Text className={s.heroSubtitle}>
              {t(
                'features.hero.subtitle',
                'No generic templates. No compromises. Discover the powerful features that make this starter kit an industrial-grade foundation.',
              )}
            </Text>
          </Flex>
        </Container>
      </Box>

      {/* Asymmetrical Features Grid */}
      <Box as='section' className={clsx(s.featuresSection, s.sectionPadding)}>
        <Container size='4'>
          <Box className={s.gridContainer}>
            {featuresData.map((feature, index) => (
              <Box
                key={feature.id}
                className={clsx(s.featureCard, {
                  [s.cardFeatured]: index === 0, // make the first one larger
                })}
              >
                <Link to={`/features/${feature.id}`} className={s.featureLink}>
                  <Box className={s.cardGlow} />
                  <Flex direction='column' className={s.cardContent}>
                    <Flex
                      justify='between'
                      align='start'
                      className={s.cardHeader}
                    >
                      <Flex
                        align='center'
                        justify='center'
                        className={s.featureIcon}
                      >
                        {(() => {
                          const IconComp =
                            RadixIcons[feature.icon] || RadixIcons.CubeIcon;
                          return <IconComp width={28} height={28} />;
                        })()}
                      </Flex>
                      <Text className={s.featureNumber}>{`0${index + 1}`}</Text>
                    </Flex>

                    <Box className={s.cardBody}>
                      <Heading as='h3' className={s.cardTitle}>
                        {feature.name}
                      </Heading>
                      <Text className={s.cardDescription}>
                        {feature.description}
                      </Text>
                    </Box>

                    <Flex
                      className={s.cardFooter}
                      justify='between'
                      align='center'
                    >
                      <Flex wrap='wrap' gap='2'>
                        {feature.tags.slice(0, 2).map(tag => (
                          <Text key={tag} className={s.tagBadge}>
                            {tag}
                          </Text>
                        ))}
                      </Flex>
                      <Box className={s.arrowIcon}>→</Box>
                    </Flex>
                  </Flex>
                </Link>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

export default Features;
