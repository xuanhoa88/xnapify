/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../../Icon';
import Button from '../../Button';
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
 * Notification bell with dropdown panel showing recent notifications
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

  const getTypeIcon = type => {
    switch (type) {
      case 'warning':
        return <Icon name='alert-triangle' size={16} />;
      case 'success':
        return <Icon name='check-circle' size={16} />;
      case 'error':
        return <Icon name='x-circle' size={16} />;
      default:
        return <Icon name='info' size={16} />;
    }
  };

  return (
    <div className={s.notificationWrapper} ref={dropdownRef}>
      <Button
        variant='unstyled'
        iconOnly
        className={s.notificationBtn}
        onClick={handleToggle}
        title={t('common.notifications', 'Notifications')}
      >
        <Icon name='bell' size={18} />
        {unreadCount > 0 && (
          <span className={s.notificationBadge}>{unreadCount}</span>
        )}
      </Button>

      {isOpen && (
        <div className={s.dropdown}>
          <div className={s.dropdownHeader}>
            <span className={s.dropdownTitle}>
              {t('common.notifications', 'Notifications')}
            </span>
            <span className={s.dropdownCount}>{unreadCount} new</span>
          </div>

          <div className={s.dropdownList}>
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`${s.notificationItem} ${!notification.read ? s.unread : ''}`}
              >
                <span className={s.notificationIcon}>
                  {getTypeIcon(notification.type)}
                </span>
                <div className={s.notificationContent}>
                  <div className={s.notificationTitle}>
                    {notification.title}
                  </div>
                  <div className={s.notificationMessage}>
                    {notification.message}
                  </div>
                  <div className={s.notificationTime}>{notification.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={s.dropdownFooter}>
            <Button variant='unstyled' className={s.viewAllBtn}>
              {t('common.viewAll', 'View all notifications')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminNotifications;
