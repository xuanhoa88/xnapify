/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Fragment } from 'react';

import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Flex, Text } from '@radix-ui/themes';
import { useSelector } from 'react-redux';

import { Link } from '@shared/renderer/components/History';
import { getBreadcrumbs } from '@shared/renderer/redux';

import s from './Breadcrumbs.css';

/**
 * Breadcrumbs Component
 *
 * Renders breadcrumb navigation from Redux state natively injected via Radix UI.
 * Breadcrumbs are accumulated from route hierarchy by the navigator.
 */
function AdminBreadcrumbs() {
  const breadcrumbs = useSelector(getBreadcrumbs);

  // Always render nav container to prevent SSR hydration mismatch
  // (server may have empty breadcrumbs, client populates after mount)
  const items = breadcrumbs || [];
  const lastIndex = items.length - 1;

  return (
    <Flex
      as='nav'
      align='center'
      aria-label='Breadcrumb'
      className={s.navContainer}
    >
      {items.map((item, index) => {
        const isLast = index === lastIndex;
        const hasLink = item.url && !isLast;

        return (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 && (
              <Flex
                asChild
                align='center'
                justify='center'
                px='2'
                className={s.dividerIcon}
              >
                <span>
                  <ChevronDownIcon
                    width={10}
                    height={10}
                    className={s.dividerChevron}
                  />
                </span>
              </Flex>
            )}
            {hasLink ? (
              <Text size='2' asChild>
                <Link to={item.url} className={s.breadcrumbLink}>
                  {item.label}
                </Link>
              </Text>
            ) : (
              <Text size='2' weight='medium' className={s.breadcrumbText}>
                {item.label}
              </Text>
            )}
          </Fragment>
        );
      })}
    </Flex>
  );
}

export default AdminBreadcrumbs;
