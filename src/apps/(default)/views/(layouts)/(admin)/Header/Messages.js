/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

import { EnvelopeClosedIcon } from '@radix-ui/react-icons';
import { Flex, Text, Box, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

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
 * Message indicator with dropdown panel mapped natively to Radix Flex layout
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
    <Box position='relative' ref={dropdownRef}>
      <Button
        variant='ghost'
        onClick={handleToggle}
        title={t('common.messages', 'Messages')}
        className={clsx(s.messagesBtn, { [s.messagesBtnOpen]: isOpen })}
      >
        <EnvelopeClosedIcon width={18} height={18} />
        {unreadCount > 0 && (
          <Flex align='center' justify='center' className={s.messagesBadge}>
            {unreadCount}
          </Flex>
        )}
      </Button>

      {isOpen && (
        <Box className={clsx(s.dropdownBox, s.messagesDropdown)}>
          <Flex align='center' justify='between' className={s.dropdownHeader}>
            <Text size='3' weight='bold'>
              {t('common.messages', 'Messages')}
            </Text>
            <Text size='1' color='gray'>
              {t('common.newMessagesCount', '{{count}} new', {
                count: unreadCount,
              })}
            </Text>
          </Flex>

          <Box className={s.messagesList}>
            {messages.map(message => (
              <Flex
                key={message.id}
                gap='3'
                className={clsx(s.messageItem, {
                  [s.messageItemUnread]: !message.read,
                })}
              >
                <Flex
                  align='center'
                  justify='center'
                  className={s.messageAvatar}
                >
                  {message.avatar ? (
                    <img
                      src={message.avatar}
                      alt=''
                      className={s.messageAvatarImg}
                    />
                  ) : (
                    getInitials(message.sender)
                  )}
                </Flex>
                <Flex className={s.messageContent}>
                  <Flex justify='between' align='center'>
                    <Text
                      size='3'
                      weight={message.read ? 'regular' : 'bold'}
                      className={s.messageSender}
                    >
                      {message.sender}
                    </Text>
                    <Text size='1' color='gray' className={s.messageTime}>
                      {message.time}
                    </Text>
                  </Flex>
                  <Text size='3' color='gray' className={s.messageSubject}>
                    {message.subject}
                  </Text>
                  <Text size='1' color='gray' className={s.messagePreview}>
                    {message.preview}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </Box>

          <Flex justify='center' className={s.dropdownFooter}>
            <Button variant='ghost' className={s.viewAllBtn}>
              {t('common.viewAllMessages', 'View all messages')}
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
}

export default AdminMessages;
