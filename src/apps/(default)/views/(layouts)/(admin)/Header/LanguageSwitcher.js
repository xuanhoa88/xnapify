/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import { Text, Flex } from '@radix-ui/themes';
import { useDispatch, useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu/index.js';
import Icon from '@shared/renderer/components/Icon/index.js';
import { features } from '@shared/renderer/redux/index.js';

const { getLocale, setLocale, getAvailableLocales } = features;

/**
 * LanguageSwitcher Component
 * Dropdown-based language switcher natively mapped for scalable multi-language support
 */
function AdminLanguageSwitcher() {
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);
  const availableLocales = useSelector(getAvailableLocales);

  const handleLocaleChange = useCallback(
    (locale, e) => {
      e.preventDefault();
      dispatch(setLocale(locale));
    },
    [dispatch],
  );

  // Get current language name
  const currentLanguageName = useMemo(() => {
    return availableLocales[currentLocale] || currentLocale;
  }, [availableLocales, currentLocale]);

  // Get language code (e.g., "EN" from "en-US")
  const languageCode = useMemo(() => {
    return currentLocale.split('-')[0].toUpperCase();
  }, [currentLocale]);

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
    <ContextMenu>
      <ContextMenu.Trigger asChild>
        <button
          type='button'
          suppressHydrationWarning
          title={currentLanguageName || languageCode}
          className='flex items-center gap-2 px-3 h-9 rounded-full text-gray-500 bg-transparent outline-none border-none cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900 data-[state=open]:bg-gray-100 data-[state=open]:text-gray-900'
        >
          <Icon name='GlobeIcon' size={18} />
          <Text size='2' weight='medium' className='hidden sm:block'>
            {currentLanguageName || languageCode}
          </Text>
          <Text size='2' weight='medium' className='block sm:hidden'>
            {languageCode}
          </Text>
          <Icon
            name='ChevronDownIcon'
            size={16}
            className='opacity-70 transition-transform data-[state=open]:rotate-180'
          />
        </button>
      </ContextMenu.Trigger>

      <ContextMenu.Menu
        align='end'
        variant='soft'
        size='2'
        className='min-w-[160px] z-100 p-1 bg-(--color-panel-solid) backdrop-blur-md border border-(--gray-a6) rounded-(--radius-4) shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
      >
        {localeEntries.map(([code, name]) => (
          <ContextMenu.Item
            key={code}
            onClick={e => handleLocaleChange(code, e)}
            className='cursor-pointer'
          >
            <Flex width='100%' justify='between' align='center' gap='3'>
              <Text
                size='2'
                color={code === currentLocale ? 'indigo' : undefined}
              >
                {name}
              </Text>
              {code === currentLocale && (
                <Icon name='CheckIcon' size={14} className='text-indigo-11' />
              )}
            </Flex>
          </ContextMenu.Item>
        ))}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

export default AdminLanguageSwitcher;
