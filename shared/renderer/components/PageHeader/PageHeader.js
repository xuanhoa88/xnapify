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
      className='pb-4 mb-6'
    >
      <Flex align='center' gap='3'>
        {icon && (
          <Flex
            align='center'
            justify='center'
            className='w-10 h-10 rounded-md bg-[var(--gray-3)] text-[var(--gray-11)] shrink-0'
          >
            {icon}
          </Flex>
        )}
        <Flex direction='column'>
          <Heading size='6'>{title}</Heading>
          {subtitle && (
            <Text size='2' color='gray' mt='1'>
              {subtitle}
            </Text>
          )}
        </Flex>
      </Flex>
      {children && (
        <Flex align='center' gap='2'>
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
