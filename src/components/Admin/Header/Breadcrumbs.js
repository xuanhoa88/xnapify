/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Fragment } from 'react';
import { useSelector } from 'react-redux';
import { Link } from '../../History';
import Icon from '../../Icon';
import { getBreadcrumbs } from '../../../redux';
import s from './Breadcrumbs.css';

/**
 * Breadcrumbs Component
 *
 * Renders breadcrumb navigation from Redux state.
 * Breadcrumbs are accumulated from route hierarchy by the navigator.
 */
function AdminBreadcrumbs() {
  const breadcrumbs = useSelector(getBreadcrumbs);

  // Don't render if no breadcrumbs
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  const lastIndex = breadcrumbs.length - 1;

  return (
    <nav className={s.breadcrumbs} aria-label='Breadcrumb'>
      {breadcrumbs.map((item, index) => {
        const isLast = index === lastIndex;
        const hasLink = item.url && !isLast;

        return (
          <Fragment key={item.url || item.label}>
            {index > 0 && (
              <Icon name='chevronDown' size={10} className={s.separator} />
            )}
            {hasLink ? (
              <Link className={s.homeLink} to={item.url}>
                {item.label}
              </Link>
            ) : (
              <span className={s.current}>{item.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export default AdminBreadcrumbs;
