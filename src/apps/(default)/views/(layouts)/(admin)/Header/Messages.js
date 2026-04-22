/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState } from 'react';

import { EnvelopeClosedIcon } from '@radix-ui/react-icons';
import { Flex, Text, Box, Button, Popover } from '@radix-ui/themes';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

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
  const [messages] = useState(mockMessages);

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          variant='ghost'
          title={t('common.messages', 'Messages')}
          className='relative flex items-center justify-center w-9 h-9 rounded-full text-gray-11 cursor-pointer transition-colors bg-transparent hover:bg-gray-3 hover:text-gray-12 data-[state=open]:bg-gray-3 data-[state=open]:text-gray-12'
        >
          <EnvelopeClosedIcon width={18} height={18} />
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
            {t('common.messages', 'Messages')}
          </Text>
          <Text size='1' color='gray'>
            {t('common.newMessagesCount', '{{count}} new', {
              count: unreadCount,
            })}
          </Text>
        </Flex>

        <Box className='max-h-[360px] overflow-y-auto'>
          {messages.map(message => (
            <Flex
              key={message.id}
              gap='3'
              className={clsx(
                'px-4 py-3 border-b border-gray-a6 bg-transparent cursor-pointer transition-colors hover:bg-gray-3',
                { 'bg-indigo-2 hover:bg-indigo-3': !message.read },
              )}
            >
              <Flex
                align='center'
                justify='center'
                className='w-10 h-10 rounded-full bg-gray-4 text-gray-11 font-bold flex-shrink-0 flex items-center justify-center'
              >
                {message.avatar ? (
                  <img
                    src={message.avatar}
                    alt=''
                    className='w-full h-full rounded-full'
                  />
                ) : (
                  getInitials(message.sender)
                )}
              </Flex>
              <Flex direction='column' width='100%' overflow='hidden'>
                <Flex justify='between' align='center'>
                  <Text
                    size='3'
                    weight={message.read ? 'regular' : 'bold'}
                    truncate
                  >
                    {message.sender}
                  </Text>
                  <Text size='1' color='gray' shrink='0' ml='2'>
                    {message.time}
                  </Text>
                </Flex>
                <Text size='3' color='gray' truncate mt='1'>
                  {message.subject}
                </Text>
                <Text size='1' color='gray' truncate mt='1'>
                  {message.preview}
                </Text>
              </Flex>
            </Flex>
          ))}
        </Box>

        <Flex
          justify='center'
          className='p-2 bg-gray-2 border-t border-gray-a6'
        >
          <Button
            variant='ghost'
            className='text-indigo-11 text-sm font-medium cursor-pointer no-underline hover:underline'
          >
            {t('common.viewAllMessages', 'View all messages')}
          </Button>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}

export default AdminMessages;
