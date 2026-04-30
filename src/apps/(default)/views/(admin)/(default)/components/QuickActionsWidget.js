import { PlusIcon } from '@radix-ui/react-icons';
import { Flex, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import WidgetCard from './WidgetCard';

import s from './QuickActionsWidget.css';

export default function QuickActionsWidget() {
  const { t } = useTranslation();

  return (
    <WidgetCard title={t('admin:dashboard.quickActions', 'Quick Actions')}>
      <Flex direction='column' gap='3'>
        <Button
          variant='soft'
          color='blue'
          style={{ justifyContent: 'flex-start' }}
          asChild
        >
          <Link to='/admin/users/create' className={s.interactiveLink}>
            <PlusIcon width='16' height='16' />
            {t('admin:dashboard.inviteUser', 'Invite User')}
          </Link>
        </Button>
        <Button
          variant='soft'
          color='indigo'
          style={{ justifyContent: 'flex-start' }}
          asChild
        >
          <Link to='/admin/roles/create' className={s.interactiveLink}>
            <PlusIcon width='16' height='16' />
            {t('admin:dashboard.createRole', 'Create Role')}
          </Link>
        </Button>
        <Button
          variant='soft'
          color='gray'
          style={{ justifyContent: 'flex-start' }}
          asChild
        >
          <Link to='/admin/extensions' className={s.interactiveLink}>
            <PlusIcon width='16' height='16' />
            {t('admin:dashboard.addExtension', 'Add Extension')}
          </Link>
        </Button>
      </Flex>
    </WidgetCard>
  );
}
