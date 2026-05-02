/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Skeleton, Spinner, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

/**
 * Loader Component using Radix Themes Spinner and Skeleton
 *
 * A professional loading state component for admin pages.
 * Supports different variants: spinner, skeleton, cards.
 */
function Loader({
  message = 'Loading...',
  variant = 'spinner',
  skeletonCount = 5,
  className,
}) {
  if (variant === 'skeleton') {
    return (
      <Flex direction='column' gap='4' py='4' className={className}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Flex key={i} align='center' gap='4' p='3'>
            <Skeleton width='40px' height='40px' className='rounded-full' />
            <Flex direction='column' gap='2' flexGrow='1'>
              <Skeleton height='16px' width='75%' />
              <Skeleton height='12px' width='50%' />
            </Flex>
            <Skeleton height='24px' width='64px' className='rounded-full' />
          </Flex>
        ))}
      </Flex>
    );
  }

  if (variant === 'cards') {
    return (
      <Flex gap='4' p='4' wrap='wrap' className={className}>
        {Array.from({ length: 4 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Flex
            key={i}
            direction='column'
            gap='3'
            p='5'
            flexGrow='1'
            className='min-w-[200px]'
            style={{
              border: '1px solid var(--gray-a5)',
              borderRadius: 'var(--radius-3)',
            }}
          >
            <Flex justify='between' align='center'>
              <Skeleton height='16px' width='96px' />
              <Skeleton height='20px' width='20px' />
            </Flex>
            <Skeleton height='32px' width='80px' />
            <Skeleton height='12px' width='128px' />
          </Flex>
        ))}
      </Flex>
    );
  }

  // Default: spinner variant
  return (
    <Flex
      direction='column'
      align='center'
      justify='center'
      py='9'
      className={className}
    >
      <Spinner size='3' />
      <Text size='2' color='gray' mt='4'>
        {message}
      </Text>
    </Flex>
  );
}

Loader.propTypes = {
  /** Loading message to display */
  message: PropTypes.string,
  /** Loading style variant */
  variant: PropTypes.oneOf(['spinner', 'skeleton', 'cards']),
  /** Number of skeleton rows for skeleton variant */
  skeletonCount: PropTypes.number,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default Loader;
