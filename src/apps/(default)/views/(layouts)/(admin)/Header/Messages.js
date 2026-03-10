/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '@shared/renderer/components/Icon';
import Button from '@shared/renderer/components/Button';
import s from './Messages.css';

// Mock message data
const mockMessages = [
  {
    id: 1,
    sender: 'Jane Smith',
    avatar: null,
    subject: 'Project Update',
    preview: 'The new feature is ready for review...',
    time: '5 min ago',
    read: false,
  },
  {
    id: 2,
    sender: 'Mike Johnson',
    avatar: null,
    subject: 'Meeting Tomorrow',
    preview: 'Can we reschedule our meeting to 3 PM?',
    time: '30 min ago',
    read: false,
  },
  {
    id: 3,
    sender: 'Sarah Wilson',
    avatar: null,
    subject: 'Quick Question',
    preview: 'Do you have the latest report ready?',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 4,
    sender: 'Alex Brown',
    avatar: null,
    subject: 'Welcome aboard!',
    preview: 'Thanks for adding me to the team...',
    time: '2 hours ago',
    read: false,
  },
  {
    id: 5,
    sender: 'Support Team',
    avatar: null,
    subject: 'Ticket #1234 resolved',
    preview: 'Your support ticket has been closed...',
    time: '3 hours ago',
    read: false,
  },
];

// Get initials from sender name
const getInitials = name => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Messages Component
 * Message indicator with dropdown panel showing recent messages
 */
function AdminMessages() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages] = useState(mockMessages);
  const dropdownRef = useRef(null);

  const unreadCount = messages.filter(m => !m.read).length;

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

  return (
    <div className={s.messagesWrapper} ref={dropdownRef}>
      <Button
        variant='unstyled'
        iconOnly
        className={s.messagesBtn}
        onClick={handleToggle}
        title={t('common.messages', 'Messages')}
      >
        <Icon name='mail' size={18} />
        {unreadCount > 0 && (
          <span className={s.messagesBadge}>{unreadCount}</span>
        )}
      </Button>

      {isOpen && (
        <div className={s.dropdown}>
          <div className={s.dropdownHeader}>
            <span className={s.dropdownTitle}>
              {t('common.messages', 'Messages')}
            </span>
            <span className={s.dropdownCount}>
              {t('common.newMessagesCount', '{{count}} new', {
                count: unreadCount,
              })}
            </span>
          </div>

          <div className={s.dropdownList}>
            {messages.map(message => (
              <div
                key={message.id}
                className={`${s.messageItem} ${!message.read ? s.unread : ''}`}
              >
                <div className={s.messageAvatar}>
                  {message.avatar ? (
                    <img src={message.avatar} alt='' />
                  ) : (
                    getInitials(message.sender)
                  )}
                </div>
                <div className={s.messageContent}>
                  <div className={s.messageSender}>{message.sender}</div>
                  <div className={s.messageSubject}>{message.subject}</div>
                  <div className={s.messagePreview}>{message.preview}</div>
                  <div className={s.messageTime}>{message.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={s.dropdownFooter}>
            <Button variant='unstyled' className={s.viewAllBtn}>
              {t('common.viewAllMessages', 'View all messages')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMessages;
