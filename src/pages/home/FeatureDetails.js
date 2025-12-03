/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { featuresData } from './data';
import s from './Features.css';

function FeatureDetails({ featureId }) {
  const feature = featuresData.find(f => f.id === featureId);

  if (!feature) {
    return (
      <div className={s.notFound}>
        <h1 className={s.notFoundTitle}>404 - Feature Not Found</h1>
        <p>The feature &apos;{featureId}&apos; does not exist.</p>
        <a href='/features' className={s.backLink}>
          ← Back to Features
        </a>
      </div>
    );
  }

  return (
    <div className={s.detailContainer}>
      <div className={s.backLinkContainer}>
        <a href='/features' className={s.backLink}>
          ← Back to all features
        </a>
      </div>
      <div className={s.detailIcon}>{feature.icon}</div>
      <h1 className={s.detailTitle}>{feature.name}</h1>
      <div className={s.detailTags}>
        {feature.tags.map(tag => (
          <span key={tag} className={s.detailTag}>
            {tag}
          </span>
        ))}
      </div>
      <p className={s.description}>{feature.description}</p>
      <div className={s.detailsBox}>
        <h3>Details</h3>
        <p>{feature.details}</p>
      </div>
    </div>
  );
}

FeatureDetails.propTypes = {
  featureId: PropTypes.string.isRequired,
};

export default FeatureDetails;
