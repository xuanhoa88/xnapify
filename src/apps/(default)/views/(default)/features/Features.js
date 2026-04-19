/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text, Heading, Grid } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import { featuresData } from '../data';

import s from './Features.css';

/**
 * Features listing substituting wrapper CSS mappings enforcing static Box sizing layouts matching native Radix.
 */
function Features() {
  const { t } = useTranslation();

  return (
    <Box>
      {/* Hero Section */}
      <Box
        as='section'
        className={`${s.heroSection} ${s.sectionPadding} ${s.textCenter} ${s.textWhite}`}
      >
        <Flex direction='column' align='center' className={s.maxWidth800}>
          <Heading as='h1' size='8' className={`${s.mb4} ${s.textWhite}`}>
            {t('features.hero.title', 'Our Features')}
          </Heading>
          <Text size='4' className={`${s.heroSubtitle} ${s.maxWidth600}`}>
            {t(
              'features.hero.subtitle',
              'Discover the powerful features that make this starter kit amazing',
            )}
          </Text>
        </Flex>
      </Box>

      {/* Features Grid */}
      <Box as='section' className={`${s.p8X4} ${s.newsBg}`}>
        <Box className={s.maxWidth1200}>
          <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap='5'>
            {featuresData.map(feature => (
              <Flex
                asChild
                key={feature.id}
                direction='column'
                className={`${s.featureCard} ${s.featureLinkCard}`}
              >
                <Link to={`/features/${feature.id}`}>
                  <Flex align='center' gap='3' className={s.mb4}>
                    <Flex
                      align='center'
                      justify='center'
                      className={s.featureIcon}
                    >
                      {feature.icon}
                    </Flex>
                    <Heading as='h3' size='4' className={s.textGray12}>
                      {feature.name}
                    </Heading>
                  </Flex>
                  <Text size='3' color='gray' className={`${s.mb4} ${s.flex1}`}>
                    {feature.description}
                  </Text>
                  <Flex wrap='wrap' gap='2' className={s.mb5}>
                    {feature.tags.map(tag => (
                      <Text key={tag} size='1' className={s.tagBadge}>
                        {tag}
                      </Text>
                    ))}
                  </Flex>
                  <Text
                    size='2'
                    weight='medium'
                    className={`${s.textIndigo11} ${s.mtAuto}`}
                  >
                    {t('features.learnMore', 'Learn more →')}
                  </Text>
                </Link>
              </Flex>
            ))}
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}

export default Features;
