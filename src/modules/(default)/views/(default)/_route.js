/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { featuresData } from './data';
import Home from './Home';

/**
 * Load news data from API
 */
export async function getInitialProps({ fetch }) {
  const { data } = await fetch('/api/news');

  return {
    news: data.news,
    featuresData,
  };
}

/**
 * Page metadata
 */
export const metadata = {
  title: 'Home',
};

/**
 * Default export - Page component
 */
export default function HomePage({ context: { initialProps } }) {
  const { news, featuresData: features } = initialProps;
  return <Home loading={false} payload={news} featuresData={features} />;
}

HomePage.propTypes = {
  context: PropTypes.shape({
    initialProps: PropTypes.shape({
      news: PropTypes.array.isRequired,
      featuresData: PropTypes.array.isRequired,
    }).isRequired,
  }).isRequired,
};
