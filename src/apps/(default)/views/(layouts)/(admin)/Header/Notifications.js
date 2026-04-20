/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Text, Box, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import s from './Notifications.css';

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
  const [isOpen, setIsOpen] = useState(false);
  const [notifications] = useState(mockNotifications);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const getTypeStyle = type => {
    switch (type) {
      case 'warning':
        return {
          color: 'var(--amber-11)',
          bg: 'var(--amber-3)',
          icon: RadixIcons.ExclamationTriangleIcon,
        };
      case 'success':
        return {
          color: 'var(--green-11)',
          bg: 'var(--green-3)',
          icon: RadixIcons.CheckCircledIcon,
        };
      case 'error':
        return {
          color: 'var(--red-11)',
          bg: 'var(--red-3)',
          icon: RadixIcons.CrossCircledIcon,
        };
      default:
        return {
          color: 'var(--blue-11)',
          bg: 'var(--blue-3)',
          icon: RadixIcons.InfoCircledIcon,
        };
    }
  };

  return (
    <Box position='relative' ref={dropdownRef}>
      <Button
        variant='ghost'
        onClick={handleToggle}
        title={t('common.notifications', 'Notifications')}
        className={clsx(s.notificationBtn, { [s.notificationBtnOpen]: isOpen })}
      >
        <RadixIcons.BellIcon width={18} height={18} />
        {unreadCount > 0 && (
          <Flex align='center' justify='center' className={s.badge}>
            {unreadCount}
          </Flex>
        )}
      </Button>

      {isOpen && (
        <Box className={clsx(s.dropdownBox, s.notificationDropdown)}>
          <Flex align='center' justify='between' className={s.dropdownHeader}>
            <Text size='3' weight='bold'>
              {t('common.notifications', 'Notifications')}
            </Text>
            <Text size='1' color='gray'>
              {t('common.newNotificationsCount', '{{count}} new', {
                count: unreadCount,
              })}
            </Text>
          </Flex>

          <Box className={s.notificationList}>
            {notifications.map(notification => {
              const typeStyle = getTypeStyle(notification.type);

              return (
                <Flex
                  key={notification.id}
                  gap='3'
                  className={clsx(s.notificationItem, {
                    [s.notificationItemUnread]: !notification.read,
                  })}
                >
                  <Flex
                    align='center'
                    justify='center'
                    className={s.notificationIcon}
                    // eslint-disable-next-line react/forbid-dom-props
                    style={{
                      backgroundColor: typeStyle.bg,
                      color: typeStyle.color,
                    }}
                  >
                    {(() => {
                      const NotificationIcon = typeStyle.icon;
                      return <NotificationIcon width={16} height={16} />;
                    })()}
                  </Flex>
                  <Flex className={s.notificationContent}>
                    <Flex justify='between' align='start'>
                      <Text
                        size='3'
                        weight={notification.read ? 'regular' : 'bold'}
                        className={s.notificationTitle}
                      >
                        {notification.title}
                      </Text>
                    </Flex>
                    <Text size='3' color='gray' className={s.notificationText}>
                      {notification.message}
                    </Text>
                    <Text size='1' color='gray' className={s.notificationTime}>
                      {notification.time}
                    </Text>
                  </Flex>
                </Flex>
              );
            })}
          </Box>

          <Flex justify='center' className={s.dropdownFooter}>
            <Button variant='ghost' className={s.viewAllBtn}>
              {t('common.viewAll', 'View all notifications')}
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
}

export default AdminNotifications;
