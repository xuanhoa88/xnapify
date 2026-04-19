/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import { featuresData } from '../../data';

import s from './FeatureDetails.css';

/**
 * Feature details natively bypassing pure CSS formats for Box objects and inline definitions aligning with standard layout requirements dynamically based on target structure rules.
 */
function FeatureDetails({ featureId }) {
  const { t } = useTranslation();
  const feature = featuresData.find(f => f.id === featureId);

  if (!feature) {
    return (
      <Box className={`${s.bgBackground} ${s.minH100}`}>
        <Box
          as='section'
          className={`${s.sectionPadding} ${s.bgRed9} ${s.textCenter} ${s.textWhite}`}
        >
          <Flex direction='column' align='center' className={s.maxWidth800}>
            <Heading as='h1' size='8' className={`${s.mb4} ${s.textWhite}`}>
              {t('features.notFound.title', '404 - Feature Not Found')}
            </Heading>
            <Text size='4' className={`${s.textRed3} ${s.mb6}`}>
              {t(
                'features.notFound.message',
                'The feature "{{featureId}}" does not exist.',
                { featureId },
              )}
            </Text>
            <Box asChild className={s.backLinkBtn}>
              <Link to='/features'>
                <ArrowLeftIcon />
                {t('features.backToFeatures', 'Back to Features')}
              </Link>
            </Box>
          </Flex>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={`${s.bgBackground} ${s.minH100}`}>
      {/* Hero Section */}
      <Box as='section' className={`${s.p8X4} ${s.heroSection} ${s.textWhite}`}>
        <Box className={s.maxWidth800}>
          <Box asChild className={s.backLinkIndigo}>
            <Link to='/features'>
              <ArrowLeftIcon />
              {t('features.backToFeatures', 'Back to Features')}
            </Link>
          </Box>
          <Flex align='center' gap='4' className={s.mb5}>
            <Flex
              align='center'
              justify='center'
              className={s.featureIconLarge}
            >
              {feature.icon}
            </Flex>
            <Heading as='h1' size='8' className={s.textWhite}>
              {feature.name}
            </Heading>
          </Flex>
          <Flex wrap='wrap' gap='2'>
            {feature.tags.map(tag => (
              <Text key={tag} size='2' className={s.tagBadgeActive}>
                {tag}
              </Text>
            ))}
          </Flex>
        </Box>
      </Box>

      {/* Content Section */}
      <Box as='section' className={s.p8X4}>
        <Box className={s.maxWidth800}>
          <Box className={s.mb8}>
            <Heading as='h2' size='6' className={s.borderBottomHeading}>
              {t('features.overview', 'Overview')}
            </Heading>
            <Text size='4' color='gray' className={s.detailsText}>
              {feature.description}
            </Text>
          </Box>

          <Box className={s.mb8}>
            <Heading as='h2' size='6' className={s.borderBottomHeading}>
              {t('features.details', 'Details')}
            </Heading>
            <Box className={s.detailsCard}>
              <Text size='3' color='gray' className={s.detailsText}>
                {feature.details}
              </Text>
            </Box>
          </Box>

          <Flex gap='4' wrap='wrap'>
            <Box asChild className={s.greyBtn}>
              <Link to='/features'>
                {t('features.viewAllFeatures', 'View All Features')}
              </Link>
            </Box>
            <Box asChild className={s.indigoBtn}>
              <Link to='/'>{t('features.backToHome', 'Back to Home')}</Link>
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}

FeatureDetails.propTypes = {
  featureId: PropTypes.string.isRequired,
};

export default FeatureDetails;
