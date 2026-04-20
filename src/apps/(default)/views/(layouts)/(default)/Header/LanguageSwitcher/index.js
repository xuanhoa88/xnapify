/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import { GlobeIcon, ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { DropdownMenu, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import {
  getLocale,
  setLocale,
  getAvailableLocales,
} from '@shared/renderer/redux';

import s from './LanguageSwitcher.css';

/**
 * LanguageSwitcher Component
 *
 * Renders a static trigger button during SSR to avoid hydration mismatches
 * and layout shift. After mount, upgrades to the full interactive DropdownMenu.
 * @version 2
 */
function LanguageSwitcher() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentLocale = useSelector(getLocale);
  const availableLocales = useSelector(getAvailableLocales);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentLanguageName = useMemo(() => {
    return availableLocales[currentLocale] || currentLocale;
  }, [availableLocales, currentLocale]);

  const handleLocaleChange = useCallback(
    locale => {
      dispatch(setLocale(locale));
    },
    [dispatch],
  );

  const localeEntries = useMemo(
    () => Object.entries(availableLocales),
    [availableLocales],
  );

  if (localeEntries.length <= 1) {
    return null;
  }

  // Static trigger button — rendered identically on server and client
  // before mount to guarantee zero hydration mismatch and no layout shift.
  const triggerButton = (
    <button
      type='button'
      title={t('common.languageSwitcher', 'Language switcher')}
      className={s.langBtn}
    >
      <GlobeIcon width={16} height={16} />
      <Text size='2'>{currentLanguageName}</Text>
      <ChevronDownIcon width={12} height={12} />
    </button>
  );

  // Before mount: render static placeholder (no DropdownMenu wrapper)
  if (!mounted) {
    return triggerButton;
  }

  // After mount: full interactive DropdownMenu
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{triggerButton}</DropdownMenu.Trigger>

      <DropdownMenu.Content align='end' variant='soft' size='2'>
        {localeEntries.map(([code, name]) => (
          <DropdownMenu.Item
            key={code}
            onSelect={() => handleLocaleChange(code)}
            className={code === currentLocale ? s.localeItemActive : undefined}
          >
            <Text size='2' mr='3'>
              {name}
            </Text>
            {code === currentLocale && (
              <CheckIcon width={14} height={14} className={s.checkIcon} />
            )}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export default LanguageSwitcher;
