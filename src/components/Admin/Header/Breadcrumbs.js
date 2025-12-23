/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from '../../History';
import Icon from '../../Icon';
import s from './Breadcrumbs.css';

/**
 * Breadcrumbs Component
 * Simple inline navigation showing current location
 */
function AdminBreadcrumbs() {
  const { t } = useTranslation();
  const history = useHistory();
  const [currentPath, setCurrentPath] = useState('');

  // Track current path
  useEffect(() => {
    setCurrentPath(history.location.pathname);
    const unsubscribe = history.listen(location => {
      setCurrentPath(location.pathname);
    });
    return unsubscribe;
  }, [history]);

  // Get current page name
  const currentPage = useMemo(() => {
    if (!currentPath || currentPath === '/admin') {
      return t('navigation.dashboard', 'Dashboard');
    }

    const segments = currentPath.split('/').filter(Boolean);
    if (segments.length <= 1) {
      return t('navigation.dashboard', 'Dashboard');
    }

    const lastSegment = segments[segments.length - 1];
    const label = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
    const translationKey = `navigation.${lastSegment}`;
    const translated = t(translationKey, label);
    return translated !== translationKey ? translated : label;
  }, [currentPath, t]);

  // Check if we're on a subpage
  const isSubPage =
    currentPath && currentPath !== '/admin' && currentPath !== '/admin/';

  return (
    <nav className={s.breadcrumbs} aria-label='Breadcrumb'>
      {isSubPage ? (
        <>
          <Link className={s.homeLink} to='/admin'>
            {t('navigation.dashboard', 'Dashboard')}
          </Link>
          <Icon name='chevronDown' size={10} className={s.separator} />
          <span className={s.current}>{currentPage}</span>
        </>
      ) : (
        <span className={s.current}>{currentPage}</span>
      )}
    </nav>
  );
}

export default AdminBreadcrumbs;
