/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import Layout from '../../components/Layout';
import s from './Privacy.css';

/**
 * Route configuration
 */
const route = {
  path: '/privacy',
};

/**
 * Privacy Page Component
 */
function PrivacyPage({ title, html }) {
  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

PrivacyPage.propTypes = {
  title: PropTypes.string.isRequired,
  html: PropTypes.string.isRequired,
};

/**
 * Route action
 * Supports locale-specific content
 */
async function action({ locale }) {
  // Load locale-specific markdown file using static imports to avoid webpack warnings
  let data;

  // Use static imports with switch statement instead of dynamic template literals
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
    component: (
      <Layout>
        <PrivacyPage title={data.attributes.title} html={data.html} />
      </Layout>
    ),
  };
}

export default [route, action];
