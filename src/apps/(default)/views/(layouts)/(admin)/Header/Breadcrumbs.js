/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Fragment } from 'react';

import { ChevronRightIcon } from '@radix-ui/react-icons';
import { Flex, Text, Box } from '@radix-ui/themes';
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

  if (items.length === 0) {
    return <Box className='h-full' />;
  }

  return (
    <Flex as='nav' align='center' aria-label='Breadcrumb' className='h-full'>
      {items.map((item, index) => {
        const isLast = index === lastIndex;
        const hasLink = item.url && !isLast;

        return (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 && (
              <Flex align='center' className='text-gray-400 mx-1.5'>
                <ChevronRightIcon width={14} height={14} />
              </Flex>
            )}
            {hasLink ? (
              <Link
                to={item.url}
                className='text-[13.5px] font-medium text-gray-500 no-underline transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm px-1 -mx-1'
              >
                {item.label}
              </Link>
            ) : (
              <Text className='text-[13.5px] font-semibold text-gray-900 px-1 -mx-1'>
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
