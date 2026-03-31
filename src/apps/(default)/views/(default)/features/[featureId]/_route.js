/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import { featuresData } from '../../data';

import FeatureDetails from './FeatureDetails';

/**
 * Load function to get feature data
 */
export async function getInitialProps({ params, i18n }) {
  const { featureId } = params;
  const feature = featuresData.find(f => f.id === featureId);

  if (!feature) {
    return {
      title: i18n.t('navigation.features', 'Features'),
      featureId,
    };
  }

  return {
    title: `${feature.name} - ${i18n.t('navigation.features', 'Features')}`,
    description: feature.description,
    featureId,
  };
}

/**
 * Default export - Page component
 */
export default function FeatureDetailsPage({ featureId }) {
  return <FeatureDetails featureId={featureId} />;
}

FeatureDetailsPage.propTypes = {
  featureId: PropTypes.string.isRequired,
};
