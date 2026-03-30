/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import Home from './components/Home';
import { featuresData } from './data';

/**
 * Load news data from API
 */
export async function getInitialProps({ fetch, i18n }) {
  let news = [];
  try {
    const res = await fetch('/api/news');
    news = (res && res.data && res.data.news) || (res && res.news) || [];
  } catch (err) {
    console.error('Failed to load news during SSR:', err.message);
  }

  return {
    news,
    features: featuresData,
    title: i18n.t('navigation.home', 'Home'),
  };
}

/**
 * Default export - Page component
 */
export default function HomePage({ context: { initialProps } }) {
  const { news = [], features = [] } = initialProps || {};
  return <Home loading={false} payload={news} featuresData={features} />;
}

HomePage.propTypes = {
  context: PropTypes.shape({
    initialProps: PropTypes.shape({
      news: PropTypes.array.isRequired,
      features: PropTypes.array.isRequired,
    }).isRequired,
  }).isRequired,
};
