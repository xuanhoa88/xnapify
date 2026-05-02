/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react';

import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';

import ContextMenu from '@shared/renderer/components/ContextMenu';
import Icon from '@shared/renderer/components/Icon';
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
        className='min-w-[160px] bg-panel-solid/90 backdrop-blur-md border border-gray-a6 rounded-md shadow-lg p-1 z-[100] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
      >
        {localeEntries.map(([code, name]) => (
          <ContextMenu.Item
            key={code}
            onClick={e => handleLocaleChange(code, e)}
            className={clsx(
              'w-full flex items-center justify-between px-3 py-2 rounded-sm text-left cursor-pointer transition-colors text-gray-12 hover:bg-gray-3 focus:outline-none focus:bg-gray-3',
              code === currentLocale &&
                'bg-indigo-3 text-indigo-11 hover:bg-indigo-3 focus:bg-indigo-3',
            )}
          >
            <Text size='2'>{name}</Text>
            {code === currentLocale && (
              <Icon name='CheckIcon' size={14} className='text-indigo-11' />
            )}
          </ContextMenu.Item>
        ))}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

export default AdminLanguageSwitcher;
