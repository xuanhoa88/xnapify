/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import FeaturesPreview from './FeaturesPreview';
import Feedback from './Feedback';
import HeroSection from './HeroSection';
import NewsSection from './NewsSection';

import s from './Home.css';

function Home({ loading, payload, featuresData }) {
  return (
    <Box className={s.bgBackground}>
      <HeroSection />
      <FeaturesPreview featuresData={featuresData} />
      <NewsSection loading={loading} news={payload} />
      <Feedback />
    </Box>
  );
}

Home.propTypes = {
  loading: PropTypes.bool.isRequired,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
      contentSnippet: PropTypes.string,
      content: PropTypes.string,
      pubDate: PropTypes.string,
    }),
  ),
  featuresData: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      details: PropTypes.string.isRequired,
      tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
  ).isRequired,
};

export default Home;
