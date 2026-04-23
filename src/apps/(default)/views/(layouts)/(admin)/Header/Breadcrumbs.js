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
import { features } from '@shared/renderer/redux';

const { getBreadcrumbs } = features;

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
    <Flex as='nav' align='center' aria-label='Breadcrumb' className='h-full'>
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
                className='text-gray-8'
              >
                <span>
                  <ChevronDownIcon
                    width={10}
                    height={10}
                    className='-rotate-90'
                  />
                </span>
              </Flex>
            )}
            {hasLink ? (
              <Text size='3' asChild>
                <Link
                  to={item.url}
                  className='text-gray-11 no-underline transition-colors duration-200 hover:text-gray-12'
                >
                  {item.label}
                </Link>
              </Text>
            ) : (
              <Text size='3' weight='medium' className='text-gray-12'>
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
