/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box, Heading } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './Privacy.css';

/**
 * Privacy Page Component
 */
function PrivacyPage({ context: { initialProps: { title, html } = {} } = {} }) {
  return (
    <Box pb='6' mx='auto' className={s.container}>
      <Box p='4' pt='6' pb='6'>
        <Heading as='h1' size='7' mb='4'>
          {title}
        </Heading>
        <Box dangerouslySetInnerHTML={{ __html: html }} className={s.content} />
      </Box>
    </Box>
  );
}

PrivacyPage.propTypes = {
  context: PropTypes.shape({
    initialProps: PropTypes.shape({
      title: PropTypes.string.isRequired,
      html: PropTypes.string.isRequired,
    }),
  }).isRequired,
};

/**
 * Load locale-specific content
 */
export async function getInitialProps({ locale }) {
  // Load locale-specific markdown file using static imports
  let data;

  // Use static imports with switch statement
  switch (locale) {
    case 'vi-VN':
      try {
        data = await import(
          /* webpackChunkName: "privacy" */ './privacy.vi-VN.md'
        );
      } catch (e) {
        // Fallback to default if locale file doesn't exist
        data = await import(/* webpackChunkName: "privacy" */ './privacy.md');
      }
      break;
    default:
      // Default to English or base markdown file
      data = await import(/* webpackChunkName: "privacy" */ './privacy.md');
      break;
  }

  return {
    title: data.attributes.title,
    html: data.html,
  };
}

/**
 * Default export - Page component
 */
export default PrivacyPage;
