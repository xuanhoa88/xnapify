/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Box, Text, Heading } from '@radix-ui/themes';

import s from './TestNextJS.css';

/**
 * TestNextJSPage mapping exact Box constraints dynamically replacing implicit CSS logic reliably.
 */
export default function TestNextJSPage() {
  return (
    <Box className={s.container}>
      <Heading as='h1' size='7' mb='6' className={s.title}>
        ✅ Next.js-Style Routing Works!
      </Heading>

      <Box className={s.boxFeature} mb='6'>
        <Heading as='h2' size='5' mb='3' color='indigo'>
          File-Based Routing Test
        </Heading>
        <Text size='3' color='gray' mb='5' className={s.dBlock}>
          This page was created using the new Next.js-style routing system.
        </Text>

        <Heading as='h3' size='3' mb='2'>
          File Location:
        </Heading>
        <Box as='code' mb='5' className={s.codeBlock}>
          @apps/(default)/views/test-nextjs/_route.js
        </Box>

        <Heading as='h3' size='3' mb='2'>
          Route Path:
        </Heading>
        <Box as='code' mb='5' className={s.codeBlock}>
          /test-nextjs
        </Box>

        <Heading as='h3' size='3' mb='3'>
          Features Demonstrated:
        </Heading>
        <Flex as='ul' direction='column' gap='2' className={s.listItems}>
          <li>✅ File-based routing (_route.js)</li>
          <li>✅ Route groups: (default) removed from URL</li>
          <li>✅ Metadata export (title, description)</li>
          <li>✅ Component export as default</li>
          <li>✅ Automatic Layout Wrapping (_layout.js)</li>
        </Flex>
      </Box>

      <Box className={s.nextStepsBox}>
        <Heading as='h3' size='4' mb='3' color='blue'>
          Next Steps:
        </Heading>
        <Flex as='ol' direction='column' gap='2' className={s.listItems}>
          <li>Check browser console for discovery logs</li>
          <li>Test layout nesting with /test-nextjs/nested</li>
          <li>Verify old routes still work (/login, /about)</li>
        </Flex>
      </Box>
    </Box>
  );
}
