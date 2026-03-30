/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import s from './About.css';

/**
 * About Page Component
 */
function AboutPage({ title, html }) {
  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

AboutPage.propTypes = {
  title: PropTypes.string.isRequired,
  html: PropTypes.string.isRequired,
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
        data = await import(/* webpackChunkName: "about" */ './about.vi-VN.md');
      } catch (e) {
        // Fallback to default if locale file doesn't exist
        data = await import(/* webpackChunkName: "about" */ './about.md');
      }
      break;
    default:
      // Default to English or base markdown file
      data = await import(/* webpackChunkName: "about" */ './about.md');
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
export default AboutPage;
