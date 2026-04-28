/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Heading, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

/**
 * PageHeader — Generic page header with icon, title, subtitle, and action slot.
 *
 * Responsive behaviour:
 * - Desktop: icon, title/subtitle, and actions on a single row.
 * - Mobile (<768px): heading size shrinks, icon box shrinks, actions wrap
 *   to a full-width row for better touch targets.
 *
 * @example
 * <PageHeader title="Users" subtitle="Manage users" icon={<GroupIcon />}>
 *   <Button>Add User</Button>
 * </PageHeader>
 */
function PageHeader({ title, subtitle, icon, children }) {
  if (!title) return null;

  return (
    <Flex
      align='center'
      justify='between'
      wrap='wrap'
      gap='4'
      className='pb-4 mb-6 border-b border-[var(--gray-a4)]'
    >
      <Flex align='center' gap='3' className='min-w-0'>
        {icon && (
          <Flex
            align='center'
            justify='center'
            className='w-9 h-9 md:w-10 md:h-10 rounded-md bg-[var(--gray-3)] text-[var(--gray-11)] shrink-0'
          >
            {icon}
          </Flex>
        )}
        <Flex direction='column' className='min-w-0'>
          <Heading size={{ initial: '5', md: '6' }} className='truncate'>
            {title}
          </Heading>
          {subtitle && (
            <Text size='2' color='gray' mt='1' className='truncate'>
              {subtitle}
            </Text>
          )}
        </Flex>
      </Flex>
      {children && (
        <Flex align='center' gap='2' wrap='wrap'>
          {children}
        </Flex>
      )}
    </Flex>
  );
}

PageHeader.displayName = 'PageHeader';

PageHeader.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  children: PropTypes.node,
};

export default PageHeader;
