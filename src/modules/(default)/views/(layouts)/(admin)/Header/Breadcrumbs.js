/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Fragment } from 'react';
import { useSelector } from 'react-redux';
import { Link } from '../../../../../../components/History';
import Icon from '../../../../../../components/Icon';
import { getBreadcrumbs } from '../../../../../../shared/renderer/redux';
import s from './Breadcrumbs.css';

/**
 * Breadcrumbs Component
 *
 * Renders breadcrumb navigation from Redux state.
 * Breadcrumbs are accumulated from route hierarchy by the navigator.
 */
function AdminBreadcrumbs() {
  const breadcrumbs = useSelector(getBreadcrumbs);

  // Always render nav container to prevent SSR hydration mismatch
  // (server may have empty breadcrumbs, client populates after mount)
  const items = breadcrumbs || [];
  const lastIndex = items.length - 1;

  return (
    <nav className={s.breadcrumbs} aria-label='Breadcrumb'>
      {items.map((item, index) => {
        const isLast = index === lastIndex;
        const hasLink = item.url && !isLast;

        return (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 && (
              <Icon name='chevronDown' size={10} className={s.separator} />
            )}
            {hasLink ? (
              <Link className={s.link} to={item.url}>
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
