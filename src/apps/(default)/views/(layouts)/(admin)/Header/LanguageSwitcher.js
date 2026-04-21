/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { GlobeIcon, ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { Flex, Text, Box, Button } from '@radix-ui/themes';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';

import {
  getLocale,
  setLocale,
  getAvailableLocales,
} from '@shared/renderer/redux';

import s from './LanguageSwitcher.css';

/**
 * LanguageSwitcher Component
 * Dropdown-based language switcher natively mapped for scalable multi-language support
 */
function AdminLanguageSwitcher() {
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);
  const availableLocales = useSelector(getAvailableLocales);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Get current language name
  const currentLanguageName = useMemo(() => {
    return availableLocales[currentLocale] || currentLocale;
  }, [availableLocales, currentLocale]);

  // Get language code (e.g., "EN" from "en-US")
  const languageCode = useMemo(() => {
    return currentLocale.split('-')[0].toUpperCase();
  }, [currentLocale]);

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

  const handleLocaleChange = useCallback(
    (locale, e) => {
      e.preventDefault();
      dispatch(setLocale(locale));
      setIsOpen(false);
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
    <Box position='relative' ref={dropdownRef}>
      <Button variant='ghost' onClick={handleToggle} className={s.langBtn}>
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
        <Flex className={clsx(s.chevronIcon, isOpen && s.chevronIconOpen)}>
          <ChevronDownIcon width={12} height={12} />
        </Flex>
      </Button>

      {isOpen && (
        <Box className={s.langDropdownBox}>
          {localeEntries.map(([code, name]) => (
            <Button
              key={code}
              variant='ghost'
              onClick={e => handleLocaleChange(code, e)}
              className={clsx(
                s.localeItem,
                code === currentLocale && s.localeItemActive,
              )}
            >
              <Text size='3'>{name}</Text>
              {code === currentLocale && (
                <CheckIcon
                  width={14}
                  height={14}
                  className={s.activeCheckIcon}
                />
              )}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default AdminLanguageSwitcher;
