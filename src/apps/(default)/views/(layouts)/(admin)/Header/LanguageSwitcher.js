/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import { GlobeIcon, ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { Flex, Text, Button, DropdownMenu } from '@radix-ui/themes';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';

import { features } from '@shared/renderer/redux';
const { getLocale, setLocale, getAvailableLocales } = features;

/**
 * LanguageSwitcher Component
 * Dropdown-based language switcher natively mapped for scalable multi-language support
 */
function AdminLanguageSwitcher() {
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);
  const availableLocales = useSelector(getAvailableLocales);

  // Get current language name
  const currentLanguageName = useMemo(() => {
    return availableLocales[currentLocale] || currentLocale;
  }, [availableLocales, currentLocale]);

  // Get language code (e.g., "EN" from "en-US")
  const languageCode = useMemo(() => {
    return currentLocale.split('-')[0].toUpperCase();
  }, [currentLocale]);

  const handleLocaleChange = useCallback(
    (locale, e) => {
      e.preventDefault();
      dispatch(setLocale(locale));
    },
    [dispatch],
  );

  // Memoize available locales
  const localeEntries = useMemo(
    () => Object.entries(availableLocales),
    [availableLocales],
  );

  // If no locales or only one locale, return null
  if (localeEntries.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant='ghost'
          className='flex items-center gap-2 px-2 py-1 rounded-md text-gray-11 transition-colors hover:bg-gray-3 cursor-pointer'
        >
          <Flex align='center' justify='center' width='20px' height='20px'>
            <GlobeIcon width={18} height={18} />
          </Flex>
          <Text
            size='3'
            weight='medium'
            display={{ initial: 'none', md: 'block' }}
          >
            {currentLanguageName || languageCode}
          </Text>
          <Flex className='transition-transform duration-200 text-gray-9 data-[state=open]:rotate-180'>
            <ChevronDownIcon width={12} height={12} />
          </Flex>
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
        align='end'
        className='min-w-[160px] bg-panel-solid/90 backdrop-blur-md border border-gray-a6 rounded-md shadow-lg p-1 z-[100] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
      >
        {localeEntries.map(([code, name]) => (
          <DropdownMenu.Item
            key={code}
            onClick={e => handleLocaleChange(code, e)}
            className={clsx(
              'w-full flex items-center justify-between px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 focus:outline-none focus:bg-gray-3',
              {
                'bg-indigo-3 text-indigo-11 hover:bg-indigo-3 focus:bg-indigo-3':
                  code === currentLocale,
              },
            )}
          >
            <Text size='3'>{name}</Text>
            {code === currentLocale && (
              <CheckIcon width={14} height={14} className='text-indigo-11' />
            )}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export default AdminLanguageSwitcher;
