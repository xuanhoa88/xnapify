/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import WidgetCard from './WidgetCard';

import s from './SiteHealthWidget.css';

export default function SiteHealthWidget() {
  const { t } = useTranslation();

  return (
    <WidgetCard title={t('admin:dashboard.systemStatus', 'System Status')}>
      <Flex align='center' gap='4' py='2'>
        <Text size='2' color='gray' className={s.flex1}>
          <Text color='green' weight='bold'>
            ✓{' '}
          </Text>
          {t('admin:dashboard.dbConnected', 'Database Connected')}
        </Text>
        <Text size='2' color='gray' className={s.flex1}>
          {t(
            'admin:dashboard.systemRunning',
            'All systems are running smoothly. You can monitor system details or modify variables in the ',
          )}
          <Link to='/admin/settings' className={s.interactiveLink}>
            {t('admin:dashboard.settingsScreen', 'Settings')}
          </Link>
          .
        </Text>
      </Flex>
    </WidgetCard>
  );
}
