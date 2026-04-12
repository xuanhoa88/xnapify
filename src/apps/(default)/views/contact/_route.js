/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import Contact from './Contact';

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('navigation.contact', 'Contact'),
  };
}

/**
 * Default export - Page component
 */
export default function ContactPage({ context: { initialProps } }) {
  const { title } = initialProps || {};
  return <Contact title={title} />;
}

ContactPage.propTypes = {
  context: PropTypes.shape({
    initialProps: PropTypes.shape({
      title: PropTypes.string.isRequired,
    }),
  }).isRequired,
};
