/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading } from '@radix-ui/themes';

import s from './NestedPage.css';

/**
 * NestedTestPage explicit DOM nodes bypassing implicit nested layout mappings dynamically substituting native parameters.
 */
export default function NestedTestPage() {
  return (
    <Box>
      <Heading as='h1' size='6' mb='5' color='green'>
        ✅ Nested Page Works!
      </Heading>

      <Box className={s.nestedBoxFeature} mb='5'>
        <Heading as='h2' size='4' mb='3' color='gray'>
          Layout Nesting Test
        </Heading>
        <Text size='3' mb='5' display='block'>
          This page is explicitly wrapped by the <code>TestLayout</code>{' '}
          component. You should see a blue dashed border around this content.
        </Text>

        <Heading as='h3' size='3' mb='2' color='gray'>
          File Location:
        </Heading>
        <Box as='code' mb='5' className={s.codeBlock}>
          @apps/(default)/views/test-nextjs/nested/_route.js
        </Box>

        <Heading as='h3' size='3' mb='2' color='gray'>
          Route Path:
        </Heading>
        <Box as='code' mb='5' className={s.codeBlock}>
          /test-nextjs/nested
        </Box>

        <Heading as='h3' size='3' mb='3' color='gray'>
          Layout Hierarchy:
        </Heading>
        <Flex as='ol' direction='column' gap='2' className={s.listItems}>
          <li>Root Layout (if exists)</li>
          <li className={s.listItemBox}>
            TestLayout (Explicit Wrapper)
            <ArrowLeftIcon width={14} height={14} />
            <strong className={s.linkBox}>Wraps this page</strong>
          </li>
          <li>This page content</li>
        </Flex>
      </Box>

      <Box mt='4'>
        <Box asChild className={s.linkBox}>
          <a href='/test-nextjs'>
            <ArrowLeftIcon width={16} height={16} /> Back to Test Home
          </a>
        </Box>
      </Box>
    </Box>
  );
}
