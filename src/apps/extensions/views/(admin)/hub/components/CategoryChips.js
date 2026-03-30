/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Icon from '@shared/renderer/components/Icon';

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

  return (
    <div ref={ref} className={s.categories}>
      <button
        type='button'
        className={activeCategory === 'all' ? s.categoryActive : s.category}
        onClick={() => onSelect('all')}
      >
        <Icon name='clipboard' size={16} />
        <span>{t('admin:hub.categoryAll', 'All')}</span>
      </button>
      {categories.map(cat => (
        <button
          key={cat.key}
          type='button'
          className={activeCategory === cat.key ? s.categoryActive : s.category}
          onClick={() => onSelect(cat.key)}
        >
          <Icon name={getCategoryIcon(cat.label)} size={16} />
          <span>{cat.label}</span>
          {cat.count > 0 && (
            <span className={s.categoryCount}>{cat.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

CategoryChips.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  activeCategory: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};
