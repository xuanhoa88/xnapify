/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Text, Box, Button, Flex } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import getCategoryIcon from './getCategoryIcon';

import s from './CategoryChips.css';

export default function CategoryChips({
  categories,
  activeCategory,
  onSelect,
}) {
  const { t } = useTranslation();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = e => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const renderChip = (id, labelKey, count, isAll = false) => {
    const isActive = activeCategory === id;
    const iconName = isAll
      ? RadixIcons.ClipboardIcon
      : getCategoryIcon(labelKey);
    const labelText = isAll ? t('admin:hub.categoryAll', 'All') : labelKey;

    return (
      <Button
        key={id}
        type='button'
        variant={isActive ? 'solid' : 'soft'}
        color={isActive ? 'indigo' : 'gray'}
        radius='full'
        onClick={() => onSelect(id)}
        className={s.chipButton}
      >
        {(() => {
          const Comp = iconName;
          return <Comp width={16} height={16} />;
        })()}
        <Text as='span' size='2'>
          {labelText}
        </Text>
        {count > 0 && !isAll && (
          <Box
            as='span'
            className={clsx(
              s.countBadge,
              isActive ? s.countActive : s.countInactive,
            )}
          >
            {count}
          </Box>
        )}
      </Button>
    );
  };

  return (
    <Flex ref={ref} gap='2' className={s.scrollContainer}>
      {renderChip('all', 'all', 0, true)}
      {categories.map(cat => renderChip(cat.key, cat.label, cat.count))}
    </Flex>
  );
}

CategoryChips.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeCategory: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};
