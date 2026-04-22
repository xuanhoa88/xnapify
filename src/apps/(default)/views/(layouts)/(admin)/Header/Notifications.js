/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Text, Box, Button, Popover } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

// Mock notification data
const mockNotifications = [
  {
    id: 1,
    type: 'info',
    title: 'New user registered',
    message: 'John Doe has joined the platform',
    time: '2 min ago',
    read: false,
  },
  {
    id: 2,
    type: 'warning',
    title: 'System update scheduled',
    message: 'Maintenance window: 2:00 AM - 4:00 AM',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 3,
    type: 'success',
    title: 'Backup completed',
    message: 'Daily backup finished successfully',
    time: '3 hours ago',
    read: false,
  },
];

/**
 * Notifications Component
 * Notification bell with dropdown panel natively mapped to Radix Flex/Box layout
 */
function AdminNotifications() {
  const { t } = useTranslation();
  const [notifications] = useState(mockNotifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getTypeStyle = type => {
    switch (type) {
      case 'warning':
        return {
          colorClass: 'text-amber-11',
          bgClass: 'bg-amber-3',
          icon: RadixIcons.ExclamationTriangleIcon,
        };
      case 'success':
        return {
          colorClass: 'text-green-11',
          bgClass: 'bg-green-3',
          icon: RadixIcons.CheckCircledIcon,
        };
      case 'error':
        return {
          colorClass: 'text-red-11',
          bgClass: 'bg-red-3',
          icon: RadixIcons.CrossCircledIcon,
        };
      default:
        return {
          colorClass: 'text-blue-11',
          bgClass: 'bg-blue-3',
          icon: RadixIcons.InfoCircledIcon,
        };
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          variant='ghost'
          title={t('common.notifications', 'Notifications')}
          className='relative flex items-center justify-center w-9 h-9 rounded-full text-gray-11 cursor-pointer transition-colors bg-transparent hover:bg-gray-3 hover:text-gray-12 data-[state=open]:bg-gray-3 data-[state=open]:text-gray-12'
        >
          <RadixIcons.BellIcon width={18} height={18} />
          {unreadCount > 0 && (
            <Flex
              align='center'
              justify='center'
              className='absolute top-1 right-1 bg-red-9 text-red-1 text-[10px] font-bold min-w-[16px] h-4 rounded-full px-1 border-2 border-panel-solid flex items-center justify-center'
            >
              {unreadCount}
            </Flex>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Content
        align='end'
        className='p-0 bg-panel-solid/90 backdrop-blur-md border border-gray-a6 rounded-md shadow-lg overflow-hidden z-[100] w-[320px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
      >
        <Flex
          align='center'
          justify='between'
          className='px-4 py-3 border-b border-gray-a6 bg-gray-2'
        >
          <Text size='3' weight='bold'>
            {t('common.notifications', 'Notifications')}
          </Text>
          <Text size='1' color='gray'>
            {t('common.newNotificationsCount', '{{count}} new', {
              count: unreadCount,
            })}
          </Text>
        </Flex>

        <Box className='max-h-[360px] overflow-y-auto'>
          {notifications.map(notification => {
            const typeStyle = getTypeStyle(notification.type);

            return (
              <Flex
                key={notification.id}
                gap='3'
                className={clsx(
                  'px-4 py-3 border-b border-gray-a6 bg-transparent cursor-pointer transition-colors hover:bg-gray-3',
                  { 'bg-indigo-2 hover:bg-indigo-3': !notification.read },
                )}
              >
                <Flex
                  align='center'
                  justify='center'
                  className={clsx(
                    'w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center',
                    typeStyle.bgClass,
                    typeStyle.colorClass,
                  )}
                >
                  {(() => {
                    const NotificationIcon = typeStyle.icon;
                    return <NotificationIcon width={16} height={16} />;
                  })()}
                </Flex>
                <Flex direction='column' width='100%' overflow='hidden'>
                  <Flex justify='between' align='start'>
                    <Text
                      size='3'
                      weight={notification.read ? 'regular' : 'bold'}
                      highContrast
                    >
                      {notification.title}
                    </Text>
                  </Flex>
                  <Text size='3' color='gray' mt='1'>
                    {notification.message}
                  </Text>
                  <Text size='1' color='gray' mt='1'>
                    {notification.time}
                  </Text>
                </Flex>
              </Flex>
            );
          })}
        </Box>

        <Flex
          justify='center'
          className='p-2 bg-gray-2 border-t border-gray-a6'
        >
          <Button
            variant='ghost'
            className='text-indigo-11 text-sm font-medium cursor-pointer no-underline hover:underline'
          >
            {t('common.viewAll', 'View all notifications')}
          </Button>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}

export default AdminNotifications;
