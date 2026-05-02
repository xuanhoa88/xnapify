/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box, Heading, Container } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import s from './Privacy.css';

/**
 * Privacy Page Component
 * Natively mapped avoiding div components. Upgraded to premium editorial layout.
 */
function PrivacyPage({ context: { initialProps: { title, html } = {} } = {} }) {
  return (
    <Box className={s.pageWrapper}>
      <Container size='4'>
        <Box className={s.contentContainer}>
          <Heading as='h1' className={s.pageTitle}>
            {title}
          </Heading>
          <Box
            dangerouslySetInnerHTML={{ __html: html }}
            className={s.markdownContent}
          />
        </Box>
      </Container>
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
        data = await import(/* webpackChunkName: "privacy" */ './privacy.md');
      }
      break;
    default:
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
