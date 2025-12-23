/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import Icon from '../../Icon';
import s from './SearchBar.css';

/**
 * SearchBar Component
 * Admin header search input with keyboard shortcut hint
 */
function AdminSearchBar() {
  const { t } = useTranslation();

  return (
    <div className={s.centerSection}>
      <div className={s.searchWrapper}>
        <Icon name='search' size={16} className={s.searchIcon} />
        <input
          type='search'
          className={s.searchInput}
          placeholder={t('common.search', 'Search...')}
          aria-label={t('common.search', 'Search...')}
        />
        <span className={s.searchShortcut}>⌘K</span>
      </div>
    </div>
  );
}

export default AdminSearchBar;
