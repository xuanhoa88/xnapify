/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  ComponentInstanceIcon,
  Link2Icon,
  Share2Icon,
  FileIcon,
  LockClosedIcon,
  GearIcon,
} from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Grid, Card } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './FeaturesPreview.css';

const ICON_MAP = {
  ComponentInstanceIcon: (
    <ComponentInstanceIcon width={24} height={24} color='var(--indigo-9)' />
  ),
  Link2Icon: <Link2Icon width={24} height={24} color='var(--indigo-9)' />,
  Share2Icon: <Share2Icon width={24} height={24} color='var(--indigo-9)' />,
  FileIcon: <FileIcon width={24} height={24} color='var(--indigo-9)' />,
  LockClosedIcon: (
    <LockClosedIcon width={24} height={24} color='var(--indigo-9)' />
  ),
  GearIcon: <GearIcon width={24} height={24} color='var(--indigo-9)' />,
};

/**
 * Features preview grid natively mapped bypassing legacy class names.
 */
function FeaturesPreview({ featuresData }) {
  const { t } = useTranslation();

  return (
    <Box as='section' className={clsx(s.lightGreyBg, s.sectionPadding)}>
      <Box className={s.maxWidth1200}>
        <Flex
          direction='column'
          align='center'
          className={clsx(s.textCenter, s.mb8)}
        >
          <Heading as='h2' size='8' className={clsx(s.textGray12, s.mb3)}>
            {t('home.features.title', 'Built-In Architecture')}
          </Heading>
          <Text size='4' color='gray' className={s.maxWidth700}>
            {t(
              'home.features.subtitle',
              'Auto-discovered modules, runtime extensions, and a DI-powered lifecycle — all wired for you',
            )}
          </Text>
        </Flex>

        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap='5'>
          {featuresData.map(feature => (
            <Card key={feature.id} size='3' className={s.featureCardDynamic}>
              <Flex direction='column'>
                <Flex align='center' gap='3' className={s.mb3}>
                  <Flex
                    align='center'
                    justify='center'
                    className={s.featureIconDynamic}
                  >
                    {ICON_MAP[feature.icon] || feature.icon}
                  </Flex>
                  <Heading as='h3' size='4' className={s.textGray12}>
                    {feature.name}
                  </Heading>
                </Flex>
                <Text size='3' color='gray'>
                  {feature.description}
                </Text>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

FeaturesPreview.propTypes = {
  featuresData: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default FeaturesPreview;
