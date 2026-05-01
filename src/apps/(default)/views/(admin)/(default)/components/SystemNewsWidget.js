/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box, Text, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import WidgetCard from './WidgetCard';

import s from './SystemNewsWidget.css';

export default function SystemNewsWidget() {
  const { t } = useTranslation();

  const news = [
    t(
      'admin:dashboard.news1',
      'xnapify 1.1.0 Security and Maintenance Release scheduled.',
    ),
    t(
      'admin:dashboard.news2',
      'New extension "Advanced Analytics" is now available in the Hub.',
    ),
    t(
      'admin:dashboard.news3',
      'Documentation updated for custom Hooks and Slots system.',
    ),
    t(
      'admin:dashboard.news4',
      'Best practices for managing user permissions and roles.',
    ),
  ];

  return (
    <WidgetCard
      title={t('admin:dashboard.systemNews', 'System News & Updates')}
    >
      <Flex direction='column' gap='4'>
        <Box pb='4' className={s.headerBox}>
          <Text as='p' size='2' color='gray' mb='2'>
            {t(
              'admin:dashboard.discoverExtensions',
              'Discover new capabilities for your app.',
            )}{' '}
            <Link to='/admin/hub' className={s.interactiveLink}>
              {t('admin:dashboard.browseHub', 'Browse the Extension Hub')}
            </Link>
          </Text>
        </Box>

        <Flex direction='column' gap='3'>
          {news.map((item, index) => (
            <Text key={index} as='p' size='2' color='blue'>
              {item}
            </Text>
          ))}
        </Flex>

        <Flex gap='2' className={s.sectionContainer}>
          <Link to='/docs' className={s.interactiveLink}>
            <Text size='2'>
              {t('admin:dashboard.documentation', 'Documentation')}
            </Text>
          </Link>
          <Text size='2' color='gray'>
            |
          </Text>
          <Link to='/community' className={s.interactiveLink}>
            <Text size='2'>{t('admin:dashboard.community', 'Community')}</Text>
          </Link>
          <Text size='2' color='gray'>
            |
          </Text>
          <Link to='/releases' className={s.interactiveLink}>
            <Text size='2'>
              {t('admin:dashboard.releaseNotes', 'Release Notes')}
            </Text>
          </Link>
        </Flex>
      </Flex>
    </WidgetCard>
  );
}
