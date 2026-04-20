/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Container } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import { featuresData } from '../../data';

import s from './FeatureDetails.css';

/**
 * Redesigned Feature details using an editorial golden-ratio split layout,
 * oversized typography, and sticky contextual widgets.
 */
function FeatureDetails({ featureId }) {
  const { t } = useTranslation();
  const feature = featuresData.find(f => f.id === featureId);

  if (!feature) {
    return (
      <Box className={clsx(s.pageWrapper, s.notFoundWrapper)}>
        <Container size='4'>
          <Flex
            direction='column'
            align='center'
            justify='center'
            className={s.notFoundContent}
          >
            <Heading as='h1' className={s.notFoundTitle}>
              {t('features.notFound.title', '404')}
            </Heading>
            <Text className={s.notFoundText}>
              {t(
                'features.notFound.message',
                'The feature "{{featureId}}" does not exist.',
                { featureId },
              )}
            </Text>
            <Box asChild className={s.backBtn}>
              <Link to='/features'>
                <RadixIcons.ArrowLeftIcon width='18' height='18' />
                {t('features.backToFeatures', 'Back to Features')}
              </Link>
            </Box>
          </Flex>
        </Container>
      </Box>
    );
  }

  // Fallback string literal mapping for icons if we only have string names in data
  // Since `feature.icon` might be a string like 'ComponentInstanceIcon',
  // we render it if it's a component, or just use a generic representation or the string itself
  // Assuming the original code rendered {feature.icon} directly which implies it's a React Node or we can just render the string.

  return (
    <Box className={s.pageWrapper}>
      <Container size='4' className={s.container}>
        <Box asChild className={s.backNav}>
          <Link to='/features'>
            <RadixIcons.ArrowLeftIcon width='18' height='18' />
            <Text weight='medium'>
              {t('features.backToFeatures', 'Back to Features')}
            </Text>
          </Link>
        </Box>

        <Box className={s.splitLayout}>
          {/* Main Content (~62%) */}
          <Box className={s.mainContent}>
            <Box className={s.heroIconWrapper} aria-hidden='true'>
              {(() => {
                const IconComp =
                  RadixIcons[feature.icon] || RadixIcons.CubeIcon;
                return <IconComp width='1em' height='1em' />;
              })()}
            </Box>

            <Heading as='h1' className={s.featureTitle}>
              {feature.name}
            </Heading>

            <Text className={s.featureIntro}>{feature.description}</Text>

            <Box className={s.contentBlock}>
              <Heading as='h2' className={s.blockTitle}>
                {t('features.deepDive', 'Deep Dive')}
              </Heading>
              <Text className={s.blockText}>{feature.details}</Text>
            </Box>
          </Box>

          {/* Sticky Sidebar (~38%) */}
          <Box className={s.sidebar}>
            <Box className={s.stickyWidget}>
              <Box className={s.widgetSection}>
                <Heading as='h3' className={s.widgetTitle}>
                  {t('features.meta.tags', 'Architecture Tags')}
                </Heading>
                <Flex wrap='wrap' gap='2'>
                  {feature.tags.map(tag => (
                    <Text key={tag} className={s.tagPill}>
                      {tag}
                    </Text>
                  ))}
                </Flex>
              </Box>

              <Box className={s.widgetDivider} />

              <Box className={s.widgetSection}>
                <Heading as='h3' className={s.widgetTitle}>
                  {t('features.meta.status', 'Status')}
                </Heading>
                <Flex align='center' gap='2'>
                  <Box className={s.statusDot} />
                  <Text className={s.statusText}>Production Ready</Text>
                </Flex>
              </Box>

              <Box className={s.widgetActions}>
                <Box asChild className={s.actionBtnPrimary}>
                  <Link to='/'>{t('features.backToHome', 'Back to Home')}</Link>
                </Box>
                <Box asChild className={s.actionBtnSecondary}>
                  <Link to='/features'>
                    {t('features.viewAllFeatures', 'View All Features')}
                  </Link>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

FeatureDetails.propTypes = {
  featureId: PropTypes.string.isRequired,
};

export default FeatureDetails;
